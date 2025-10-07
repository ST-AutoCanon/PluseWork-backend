const bcrypt = require("bcrypt");
const LoginService = require("../services/loginService");
const ErrorHandler = require("../utils/errorHandler");
const { redisClient } = require("../lib/sessionStore"); // ✅ use redisClient directly
const dotenv = require("dotenv");
dotenv.config();

class LoginHandler {
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      // Fetch user by email
      const user = await LoginService.fetchUserByEmail(email);
      if (!user) {
        return res
          .status(401)
          .json(ErrorHandler.generateErrorResponse(401, "Invalid credentials"));
      }

      // Check if the employee is inactive
      if (user.status === "Inactive") {
        return res
          .status(403)
          .json(
            ErrorHandler.generateErrorResponse(
              403,
              "Account is Inactive. Please contact your administrator."
            )
          );
      }

      // Validate password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res
          .status(401)
          .json(ErrorHandler.generateErrorResponse(401, "Invalid credentials"));
      }

      // Fetch dashboard & sidebar
      const dashboardFunction =
        {
          Admin: LoginService.fetchAdminDashboard,
          Employee: LoginService.fetchEmployeeDashboard,
        }[user.role] || LoginService.fetchEmployeeDashboard;

      const dashboard = await dashboardFunction(user.employee_id);
      const sidebarMenu = await LoginService.fetchSidebarMenu(
        user.role,
        user.Org_id
      );

      const attendanceCount = await LoginService.getAttendanceStatusCount();
      const loginDataCount = await LoginService.fetchEmployeeLoginDataCount();
      const employeeCountByDepartment =
        await LoginService.getEmployeeCountByDepartment();

      req.session.lastActive = Date.now();
      req.session.userRole = user.role;

      // Build the session user object (store what's needed by /me)
      req.session.user = {
        id: user.employee_id,
        role: user.role,
        orgId: user.Org_id,
        name: user.name,
        gender: user.gender,
        // include the same dashboard / sidebarMenu you send to client
        dashboard,
        sidebarMenu,
        // optional: any other quick fields like email/employeeId
        email: user.email || null,
        employeeId: user.employee_id || null,
      };

      // ✅ Safely store session ID in Redis (if Redis ready)
      if (redisClient && typeof redisClient.sadd === "function") {
        redisClient
          .sadd(`user_sessions:${user.employee_id}`, req.sessionID)
          .catch((err) => {
            console.error("Redis error storing session:", err);
          });

        // publish login event for other instances
        redisClient
          .publish(
            "auth:changes",
            JSON.stringify({
              type: "login",
              userId: user.employee_id,
              role: user.role,
            })
          )
          .catch((err) => console.error("Redis publish error:", err));
      }

      // Save session and respond
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);

        return res.status(200).json({
          status: "success",
          code: 200,
          message: {
            role: user.role,
            name: user.name,
            org_id: user.Org_id,
            gender: user.gender,
            dashboard,
            sidebarMenu,
            attendanceCount,
            loginDataCount,
            employeeCountByDepartment,
          },
        });
      });
    } catch (err) {
      console.error("Login error:", err);
      return res
        .status(500)
        .json(ErrorHandler.generateErrorResponse(500, "Internal server error"));
    }
  }

  static async logout(req, res) {
    try {
      // get user id from session (if present)
      const uid = req.session?.user?.id;

      // destroy session server-side
      req.session.destroy(async (err) => {
        if (err) {
          console.error("Session destroy error:", err);
          // respond with 500 but still attempt cleanup
          return res.status(500).json({
            status: "error",
            code: 500,
            message: "Failed to logout cleanly",
          });
        }

        // remove session id from user's session set in redis (cleanup)
        try {
          if (uid) {
            await redisClient.srem(`user_sessions:${uid}`, req.sessionID);
            // publish logout event for other instances
            await redisClient.publish(
              "auth:changes",
              JSON.stringify({ type: "logout", userId: uid })
            );
          }
        } catch (cleanupErr) {
          console.error("Redis cleanup error on logout:", cleanupErr);
        }

        // clear cookie on client
        res.clearCookie("sid", {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });

        return res
          .status(200)
          .json({ status: "success", code: 200, message: "Logged out" });
      });
    } catch (err) {
      console.error("Logout error:", err);
      return res.status(500).json({
        status: "error",
        code: 500,
        message: "Internal server error",
      });
    }
  }

  /**
   * Handler to get the count of attendance status (Present, Sick Leave, Absent).
   */
  static async getAttendanceStatusCount(req, res) {
    try {
      const attendanceData = await LoginService.getAttendanceStatusCount();
      return res.status(200).json({
        status: "success",
        code: 200,
        message: attendanceData,
      });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json(ErrorHandler.generateErrorResponse(500, "Internal server error"));
    }
  }

  static async getEmployeeLoginDataCount(req, res) {
    try {
      const loginDataCount = await LoginService.fetchEmployeeLoginDataCount();

      if (!loginDataCount.length) {
        return res
          .status(404)
          .json(ErrorHandler.generateErrorResponse(404, "No login data found"));
      }

      // ✅ Aggregate data by punchin_label to ensure unique time slots
      const aggregatedData = {};

      loginDataCount.forEach((item) => {
        const label = item.punchin_label || "";
        if (!aggregatedData[label]) {
          aggregatedData[label] = {
            daily_count: 0,
            weekly_count: 0,
            monthly_count: 0,
          };
        }
        aggregatedData[label].daily_count += parseInt(item.daily_count || 0);
        aggregatedData[label].weekly_count += parseInt(item.weekly_count || 0);
        aggregatedData[label].monthly_count += parseInt(
          item.monthly_count || 0
        );
      });

      // ✅ Convert object back to an array format
      const labels = Object.keys(aggregatedData);
      const daily = labels.map((label) => aggregatedData[label].daily_count);
      const weekly = labels.map((label) => aggregatedData[label].weekly_count);
      const monthly = labels.map(
        (label) => aggregatedData[label].monthly_count
      );

      return res.status(200).json({
        status: "success",
        code: 200,
        data: { labels, daily, weekly, monthly },
      });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json(ErrorHandler.generateErrorResponse(500, "Internal server error"));
    }
  }

  /**
   * Handler to get salary ranges.
   */
  static async getSalaryRanges(req, res) {
    try {
      const salaryRanges = await LoginService.fetchSalaryRanges();
      return res.status(200).json({
        status: "success",
        code: 200,
        message: salaryRanges,
      });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json(ErrorHandler.generateErrorResponse(500, "Internal server error"));
    }
  }

  /**
   * Handler to get employee count by department.
   */
  static async getEmployeeCountByDepartment(req, res) {
    try {
      const categories = await LoginService.getEmployeeCountByDepartment();

      if (!categories || categories.length === 0) {
        return res
          .status(404)
          .json(ErrorHandler.generateErrorResponse(404, "No data found"));
      }

      // Calculate total employees
      const totalEmployees = categories.reduce(
        (sum, item) => sum + item.count,
        0
      );

      // Structure the response correctly
      return res.status(200).json({
        totalEmployees,
        categories,
      });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json(ErrorHandler.generateErrorResponse(500, "Internal server error"));
    }
  }

  /**
   * Handler to get payroll data for an employee.
   */
  static async getEmployeePayrollData(req, res) {
    try {
      const { employeeId } = req.params;

      // Fetch payroll data
      const payrollData = await LoginService.getEmployeePayrollData(employeeId);

      if (!payrollData) {
        return res
          .status(404)
          .json(
            ErrorHandler.generateErrorResponse(404, "No payroll data found")
          );
      }

      return res.status(200).json({
        status: "success",
        code: 200,
        message: payrollData,
      });
    } catch (err) {
      console.error("Error fetching employee payroll data:", err);
      return res
        .status(500)
        .json(ErrorHandler.generateErrorResponse(500, "Internal server error"));
    }
  }
}

module.exports = LoginHandler;
