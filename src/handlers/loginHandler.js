const bcrypt = require("bcrypt");
const LoginService = require("../services/loginService");
const ErrorHandler = require("../utils/errorHandler");
const { redisClient } = require("../lib/sessionStore");
const dotenv = require("dotenv");
const moment = require("moment");
dotenv.config();

class LoginHandler {
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      const user = await LoginService.fetchUserByEmail(email);
      if (!user) {
        return res
          .status(401)
          .json(ErrorHandler.generateErrorResponse(401, "Invalid credentials"));
      }

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

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res
          .status(401)
          .json(ErrorHandler.generateErrorResponse(401, "Invalid credentials"));
      }

      try {
        const org = await LoginService.fetchOrganizationById(user.Org_id);
        if (org && org.end_date) {
          const today = moment().startOf("day");
          const orgEnd = moment(org.end_date).endOf("day");
          if (orgEnd.isBefore(today, "day")) {
            return res
              .status(403)
              .json(
                ErrorHandler.generateErrorResponse(
                  403,
                  "your subscription ended, to renew kindly contact Administrator"
                )
              );
          }
        }
      } catch (orgErr) {
        console.error("Org expiry check failed:", orgErr);
      }

      req.session.lastActive = Date.now();
      req.session.userRole = user.role;

      req.session.user = {
        id: user.employee_id,
        role: user.role,
        orgId: user.Org_id,
        name: user.name,
        gender: user.gender,
        email: user.email || null,
        employeeId: user.employee_id || null,
      };

      if (redisClient && typeof redisClient.sadd === "function") {
        redisClient
          .sadd(`user_sessions:${user.employee_id}`, req.sessionID)
          .catch((err) => {
            console.error("Redis error storing session:", err);
          });

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
            employeeId: user.employee_id,
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
      const uid = req.session?.user?.id;

      req.session.destroy(async (err) => {
        if (err) {
          console.error("Session destroy error:", err);
          return res.status(500).json({
            status: "error",
            code: 500,
            message: "Failed to logout cleanly",
          });
        }

        try {
          if (uid && redisClient && typeof redisClient.srem === "function") {
            await redisClient.srem(`user_sessions:${uid}`, req.sessionID);
            await redisClient.publish(
              "auth:changes",
              JSON.stringify({ type: "logout", userId: uid })
            );
          }
        } catch (cleanupErr) {
          console.error("Redis cleanup error on logout:", cleanupErr);
        }

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

  static async getSidebar(req, res) {
    try {
      const role = req.session?.user?.role;
      const orgId = req.session?.user?.orgId;

      if (!role || !orgId) {
        return res
          .status(401)
          .json(ErrorHandler.generateErrorResponse(401, "Unauthorized"));
      }

      const cacheKey = `sidebar:${role}:${orgId}`;
      try {
        if (redisClient && typeof redisClient.get === "function") {
          const cached = await redisClient.get(cacheKey);
          if (cached) {
            return res.status(200).json({
              status: "success",
              code: 200,
              message: JSON.parse(cached),
              cached: true,
            });
          }
        }
      } catch (cacheErr) {
        console.warn("Sidebar cache read failed:", cacheErr);
      }

      const sidebarMenu =
        (await LoginService.fetchSidebarMenu(role, orgId)) || [];

      try {
        if (redisClient && typeof redisClient.set === "function") {
          await redisClient.set(
            cacheKey,
            JSON.stringify(sidebarMenu),
            "EX",
            300
          );
        }
      } catch (cacheErr) {
        console.warn("Sidebar cache write failed:", cacheErr);
      }

      return res.status(200).json({
        status: "success",
        code: 200,
        message: sidebarMenu,
      });
    } catch (err) {
      console.error("getSidebar error:", err);
      return res
        .status(500)
        .json(ErrorHandler.generateErrorResponse(500, "Internal server error"));
    }
  }

  static async getDashboard(req, res) {
    try {
      const user = req.session?.user;
      if (!user || !user.employeeId) {
        return res
          .status(401)
          .json(ErrorHandler.generateErrorResponse(401, "Unauthorized"));
      }

      let dashboard = {};
      try {
        if ((user.role || "").toLowerCase() === "admin") {
          dashboard = await LoginService.fetchAdminDashboard(user.employeeId);
        } else {
          dashboard = await LoginService.fetchEmployeeDashboard(
            user.employeeId
          );
        }
      } catch (dashErr) {
        console.warn("Dashboard fetch failed:", dashErr?.message || dashErr);
        dashboard = {};
      }

      return res.status(200).json({
        status: "success",
        code: 200,
        message: dashboard,
      });
    } catch (err) {
      console.error("getDashboard error:", err);
      return res
        .status(500)
        .json(ErrorHandler.generateErrorResponse(500, "Internal server error"));
    }
  }

  static async getAttendanceStatusCount(req, res) {
    try {
      const orgId = req.session?.user?.orgId;
      if (!orgId) {
        return res
          .status(401)
          .json(ErrorHandler.generateErrorResponse(401, "Unauthorized"));
      }

      const attendanceData = await LoginService.getAttendanceStatusCount(orgId);
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
      const orgId = req.session?.user?.orgId;
      if (!orgId)
        return res
          .status(401)
          .json(ErrorHandler.generateErrorResponse(401, "Unauthorized"));

      const loginDataCount = await LoginService.fetchEmployeeLoginDataCount(
        orgId
      );

      if (!loginDataCount || loginDataCount.length === 0) {
        return res.status(200).json({
          status: "success",
          code: 200,
          data: { labels: [], daily: [], weekly: [], monthly: [] },
        });
      }

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

  static async getSalaryRanges(req, res) {
    try {
      const orgId = req.session?.user?.orgId;
      if (!orgId)
        return res
          .status(401)
          .json(ErrorHandler.generateErrorResponse(401, "Unauthorized"));

      const salaryRanges = await LoginService.fetchSalaryRanges(orgId);

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

  static async getEmployeeCountByDepartment(req, res) {
    try {
      const orgId = req.session?.user?.orgId;
      if (!orgId)
        return res
          .status(401)
          .json(ErrorHandler.generateErrorResponse(401, "Unauthorized"));

      const categories = await LoginService.getEmployeeCountByDepartment(orgId);

      if (!categories || categories.length === 0) {
        return res.status(200).json({
          totalEmployees: 0,
          categories: [],
        });
      }

      const totalEmployees = categories.reduce(
        (sum, item) => sum + (item.count || 0),
        0
      );

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

  static async getEmployeePayrollData(req, res) {
    try {
      const { employeeId } = req.params;

      const payrollData = await LoginService.getEmployeePayrollData(employeeId);

      if (!payrollData) {
        return res.status(200).json({
          status: "success",
          code: 200,
          message: {
            total_previous_month_credit: 0,
            total_previous_month_expenses: 0,
            total_previous_month_salary: 0,
          },
        });
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
