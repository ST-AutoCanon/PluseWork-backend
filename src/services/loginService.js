const db = require("../config");
const queries = require("../constants/loginQueries");
const moment = require("moment");

class LoginService {
  static async fetchUserByEmail(email) {
    const [rows] = await db.execute(queries.GET_USER_BY_EMAIL, [email]);
    return rows[0];
  }

  static async fetchOrganizationById(orgId) {
    if (!orgId) return null;
    const [rows] = await db.execute(queries.GET_END_DATE, [orgId]);
    return rows && rows.length ? rows[0] : null;
  }

  static async fetchAdminDashboard(employee_id) {
    const [adminDetails] = await db.execute(queries.GET_ADMIN_DETAILS, [
      employee_id,
    ]);

    if (!adminDetails || adminDetails.length === 0) {
      return {
        name: null,
        employeeId: null,
        email: null,
        gender: null,
        orgId: null,
        total_employees: 0,
        attendance: { present: 0, sick_leave: 0, other_absence: 0 },
        salary_distribution: {
          average_salary: 0,
          min_salary: 0,
          max_salary: 0,
        },
        department_distribution: [],
        login_timer_graph: [],
        financial_stats: {
          previous_month_expenses: 0,
          previous_month_salary: 0,
          previous_month_credit: 0,
        },
        projects: { current: [], upcoming: [], previous: [] },
      };
    }

    const admin = adminDetails[0];
    const orgId = admin.Org_id;

    const [dashboardStats] = await db.execute(queries.GET_ADMIN_DASHBOARD, [
      orgId,
      orgId,
      orgId,
    ]);

    const [salaryDistribution] = await db.execute(
      queries.GET_SALARY_DISTRIBUTION,
      [orgId]
    );

    const [departmentDistribution] = await db.execute(
      queries.GET_DEPARTMENT_DISTRIBUTION,
      [orgId]
    );

    const today = moment().startOf("day");
    const periods = {
      daily: { start: today, end: moment(today).endOf("day") },
      weekly: { start: moment(today).subtract(6, "days"), end: moment() },
      monthly: { start: moment(today).subtract(29, "days"), end: moment() },
    };

    const { start, end } = periods["daily"];

    const [loginData] = await db.execute(queries.GET_HOURLY_LOGIN_DATA, [
      orgId,
      start.toISOString(),
      end.toISOString(),
    ]);

    const [currentProjects] = await db.execute(queries.GET_CURRENT_PROJECTS, [
      orgId,
    ]);
    const [upcomingProjects] = await db.execute(queries.GET_UPCOMING_PROJECTS, [
      orgId,
    ]);
    const [previousProjects] = await db.execute(queries.GET_PREVIOUS_PROJECTS, [
      orgId,
    ]);

    const [financialStats] = await db.execute(queries.GET_FINANCIAL_STATS, [
      orgId,
    ]);

    return {
      name: admin.name,
      employeeId: admin.employee_id,
      email: admin.email,
      gender: admin.gender,
      orgId: orgId,
      total_employees: dashboardStats?.[0]?.total_employees || 0,
      attendance: {
        present: dashboardStats?.[0]?.present || 0,
        sick_leave: dashboardStats?.[0]?.sick_leave || 0,
        other_absence: dashboardStats?.[0]?.other_absence || 0,
      },
      salary_distribution: salaryDistribution?.[0] || {
        average_salary: 0,
        min_salary: 0,
        max_salary: 0,
      },
      department_distribution: departmentDistribution || [],
      login_timer_graph: loginData || [],
      financial_stats: {
        previous_month_expenses:
          financialStats?.[0]?.previous_month_expenses || 0,
        previous_month_salary: financialStats?.[0]?.previous_month_salary || 0,
        previous_month_credit: financialStats?.[0]?.previous_month_credit || 0,
      },
      projects: {
        current:
          (currentProjects &&
            currentProjects.map((project) => ({
              project_name: project.project_name,
              job_type: project.job_type,
              department: project.department,
              start_date: project.start_date,
              end_date: project.end_date,
              comments: project.comments,
            }))) ||
          [],
        upcoming: upcomingProjects || [],
        previous: previousProjects || [],
      },
    };
  }

  static async fetchEmployeeDashboard(employeeId) {
    try {
      const [rows] = await db.execute(queries.GET_EMPLOYEE_DASHBOARD, [
        employeeId,
      ]);

      if (!rows || rows.length === 0) {
        return {
          name: null,
          employeeId: employeeId || null,
          position: null,
          gender: null,
          department_id: null,
          department: null,
          salary: 0,
          photoUrl: null,
          attendance_count: 0,
          leave_queries_count: 0,
          attendance_breakdown: {
            present: 0,
            sick_leave: 0,
            other_absence: 0,
          },
        };
      }

      const emp = rows[0];

      return {
        name: emp.name,
        employeeId: emp.employee_id,
        position: emp.position,
        gender: emp.gender,
        department_id: emp.department_id,
        department: emp.department,
        salary: emp.salary,
        photoUrl: emp.photo_url,
        attendance_count: emp.attendance_count || 0,
        leave_queries_count: emp.leave_queries_count || 0,
        attendance_breakdown: {
          present: emp.attendance_count || 0,
          sick_leave: emp.sick_leave || 0,
          other_absence: emp.other_absence || 0,
        },
      };
    } catch (err) {
      console.error("Error in fetchEmployeeDashboard:", err.message);
      return {
        name: null,
        employeeId: employeeId || null,
        position: null,
        gender: null,
        department_id: null,
        department: null,
        salary: 0,
        photoUrl: null,
        attendance_count: 0,
        leave_queries_count: 0,
        attendance_breakdown: {
          present: 0,
          sick_leave: 0,
          other_absence: 0,
        },
      };
    }
  }

  static async fetchSidebarMenu(role, orgId) {
    const [menuItems] = await db.execute(queries.GET_SIDEBAR_MENU, [
      role,
      orgId,
    ]);
    return menuItems || [];
  }

  static async getAttendanceStatusCount(orgId) {
    try {
      const [rows] = await db.execute(queries.GET_ATTENDANCE_STATUS_COUNT, [
        orgId,
        orgId,
        orgId,
      ]);

      if (!rows || rows.length === 0) {
        return { totalEmployees: 0, categories: [] };
      }

      const {
        totalEmployees = 0,
        present = 0,
        approved_leave = 0,
      } = rows[0] || {};

      const absent = Math.max(
        0,
        (totalEmployees || 0) - (present || 0) - (approved_leave || 0)
      );

      return {
        totalEmployees: totalEmployees || 0,
        categories: [
          { label: "Present", count: present || 0, color: "#004DC6" },
          { label: "Leave", count: approved_leave || 0, color: "#438CFF" },
          { label: "Absent", count: absent || 0, color: "#C7DDFF" },
        ],
      };
    } catch (error) {
      console.error("Error fetching attendance status count:", error);
      throw new Error(
        "Failed to fetch attendance status count: " + error.message
      );
    }
  }

  static async fetchEmployeeLoginDataCount(orgId) {
    try {
      const [rows] = await db.execute(queries.GET_EMPLOYEE_LOGIN_DATA_COUNT, [
        orgId,
      ]);
      return rows || [];
    } catch (error) {
      console.error("Database Query Error:", error);
      throw new Error("Failed to fetch login data count: " + error.message);
    }
  }

  static async fetchSalaryRanges(orgId) {
    try {
      const [rows] = await db.execute(queries.GET_EMPLOYEE_SALARY_RANGE, [
        orgId,
      ]);

      const labels = (rows || []).map((row) => row.salary_range);
      const data = (rows || []).map((row) => row.count || 0);

      return {
        labels,
        datasets: [
          {
            label: "Salaries",
            data,
            backgroundColor: [
              "#82DAFE",
              "#00A1DA",
              "#0078CF",
              "#012FBA",
              "#011F7B",
            ],
          },
        ],
      };
    } catch (error) {
      console.error("Error fetching salary ranges:", error);
      throw new Error("Failed to fetch salary ranges: " + error.message);
    }
  }

  static async getEmployeeCountByDepartment(orgId) {
    try {
      const [rows] = await db.execute(
        queries.GET_EMPLOYEE_COUNT_BY_DEPARTMENT,
        [orgId]
      );
      return rows || [];
    } catch (error) {
      console.error("Error fetching employee count by department:", error);
      throw new Error(
        "Failed to fetch employee count by department: " + error.message
      );
    }
  }

  static async getEmployeePayrollData(orgId) {
    try {
      const [rows] = await db.execute(queries.GET_EMPLOYEE_PAYROLL, [orgId]);

      return {
        total_previous_month_credit:
          rows?.[0]?.total_previous_month_credit || 0,
        total_previous_month_expenses:
          rows?.[0]?.total_previous_month_expenses || 0,
        total_previous_month_salary:
          rows?.[0]?.total_previous_month_salary || 0,
      };
    } catch (error) {
      console.error("Error fetching employee payroll data:", error);
      throw new Error("Failed to fetch payroll data: " + error.message);
    }
  }
}

module.exports = LoginService;
