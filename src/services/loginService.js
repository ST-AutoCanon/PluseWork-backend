const db = require("../config");
const queries = require("../constants/loginQueries");
const moment = require("moment");
const crypto = require("crypto");
const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");

async function getTenantPoolForOrgId(orgId) {
  if (!orgId) throw new Error("orgId required to get tenant pool");
  const dbName = sanitizeDbName(`tenant_${orgId}`);
  return getTenantPool(dbName);
}

async function findOrgIdForEmployeeId(employeeId) {
  if (!employeeId || typeof employeeId !== "string") return null;
  const parts = employeeId.split("-");
  if (!parts.length) return null;
  const prefix = parts[0].toUpperCase();

  const [rows] = await db.execute(queries.SELECT_ORG_ID_BY_PREFIX, [prefix]);
  if (!rows || rows.length === 0) return null;
  return rows[0].id;
}

class LoginService {
  static async fetchUserByEmail(email, opts = {}) {
    const { orgId = null, superAdmin = false } = opts || {};
    if (!email) return null;

    if (superAdmin === true) {
      try {
        const [adminRows] = await db.execute(queries.GET_ADMIN_BY_EMAIL, [
          email,
        ]);
        if (adminRows && adminRows.length > 0) {
          const a = adminRows[0];
          return {
            role: a.role_name || "SuperAdmin",
            role_id: a.role_id || 1,
            employee_id: `ADMIN_${a.admin_id}`,
            Org_id: null,
            name: a.name || null,
            gender: null,
            email: a.email,
            password: a.password,
            position: null,
            status: "Active",
            department: null,
          };
        }
        return null;
      } catch (e) {
        console.error("[LoginService] master admin lookup failed:", e);
        return null;
      }
    }

    if (!orgId) {
      const err = new Error("orgId is required for tenant login");
      err.code = "ORG_REQUIRED";
      throw err;
    }

    try {
      const tenantPool = await getTenantPoolForOrgId(orgId);
      const [rows] = await tenantPool.query(queries.GET_USER_BY_EMAIL, [email]);
      if (rows && rows.length > 0) {
        const user = rows[0];
        user.Org_id = user.Org_id || orgId;
        return user;
      }
      return null;
    } catch (tenantErr) {
      if (
        tenantErr &&
        (tenantErr.code === "ER_NO_SUCH_TABLE" ||
          tenantErr.code === "ER_BAD_DB_ERROR" ||
          tenantErr.code === "ER_DBACCESS_DENIED_ERROR")
      ) {
        const err = new Error(
          `Tenant schema for org ${orgId} is not provisioned or inaccessible`,
        );
        err.code = "TENANT_SCHEMA";
        err.original =
          tenantErr && tenantErr.message ? tenantErr.message : tenantErr;
        throw err;
      }

      const err = new Error(`Tenant lookup failed for org ${orgId}`);
      err.code = "TENANT_LOOKUP_FAILED";
      err.original = tenantErr && tenantErr.stack ? tenantErr.stack : tenantErr;
      throw err;
    }
  }

  static async fetchOrganizationById(orgId) {
    if (!orgId) return null;
    const [rows] = await db.execute(queries.GET_END_DATE, [orgId]);
    return rows && rows.length ? rows[0] : null;
  }

  static async fetchOrgIdNameList() {
    const [rows] = await db.execute(queries.GET_ORG_ID_NAME_LIST);
    return (rows || []).map((r) => ({ id: r.id, name: r.name }));
  }

  static async fetchSidebarMenu(role, orgId) {
    try {
      if (!role || !orgId) return [];

      const tenantPool = await getTenantPoolForOrgId(orgId);

      const [accessRows] = await tenantPool.query(
        queries.GET_SIDEBAR_ACCESS_BY_ROLE,
        [orgId, role],
      );

      if (!accessRows || accessRows.length === 0) return [];

      const ids = accessRows.map((r) => r.sidebar_item_id).filter(Boolean);
      if (ids.length === 0) return [];

      const [menuRows] = await db.query(queries.GET_SIDEBAR_MENU_BY_IDS, [ids]);

      if (!menuRows || menuRows.length === 0) return [];

      const menuMap = new Map(menuRows.map((m) => [m.id, m]));
      const ordered = [];
      const seen = new Set();
      for (const id of ids) {
        if (seen.has(id)) continue;
        seen.add(id);
        const item = menuMap.get(id);
        if (item) ordered.push(item);
      }

      return ordered;
    } catch (err) {
      console.error(
        "[fetchSidebarMenu] unexpected error:",
        err && (err.stack || err),
      );
      throw new Error("Failed to fetch sidebar menu");
    }
  }

  static async getAttendanceStatusCount(orgId) {
    try {
      if (!orgId) throw new Error("orgId required");
      const tenantDb = await getTenantPoolForOrgId(orgId);
      const [rows] = await tenantDb.query(queries.GET_ATTENDANCE_STATUS_COUNT, [
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
        (totalEmployees || 0) - (present || 0) - (approved_leave || 0),
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
        "Failed to fetch attendance status count: " + (error.message || error),
      );
    }
  }

  static async fetchEmployeeLoginDataCount(orgId) {
    try {
      if (!orgId) return [];
      const tenantDb = await getTenantPoolForOrgId(orgId);
      const [rows] = await tenantDb.query(
        queries.GET_EMPLOYEE_LOGIN_DATA_COUNT,
        [orgId],
      );
      return rows || [];
    } catch (error) {
      console.error("Database Query Error:", error);
      throw new Error("Failed to fetch login data count: " + error.message);
    }
  }

  static async fetchSalaryRanges(orgId) {
    try {
      if (!orgId) return { labels: [], datasets: [] };
      const tenantDb = await getTenantPoolForOrgId(orgId);
      const [rows] = await tenantDb.query(queries.GET_EMPLOYEE_SALARY_RANGE, [
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
      if (!orgId) return [];
      const tenantDb = await getTenantPoolForOrgId(orgId);
      const [rows] = await tenantDb.query(
        queries.GET_EMPLOYEE_COUNT_BY_DEPARTMENT,
        [orgId],
      );
      return rows || [];
    } catch (error) {
      console.error("Error fetching employee count by department:", error);
      throw new Error(
        "Failed to fetch employee count by department: " + error.message,
      );
    }
  }

  static async getEmployeePayrollData(orgId) {
    try {
      if (!orgId) return null;
      const tenantDb = await getTenantPoolForOrgId(orgId);
      const [rows] = await tenantDb.query(queries.GET_EMPLOYEE_PAYROLL, [
        orgId,
      ]);

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

  static hashAutoLoginToken(token) {
    return crypto.createHash("sha256").update(String(token)).digest("hex");
  }

  static async createAutoLoginLink({
    token,
    orgId,
    email,
    allowedIp = null,
    expiresAt,
    maxUses = 999999,
    createdBy = null,
  }) {
    const tokenHash = LoginService.hashAutoLoginToken(token);

    const [result] = await db.execute(queries.INSERT_AUTO_LOGIN_LINK, [
      tokenHash,
      orgId,
      email,
      allowedIp,
      expiresAt,
      maxUses,
      createdBy,
    ]);

    return result;
  }

  static async fetchAutoLoginLinkByToken(token) {
    const tokenHash = LoginService.hashAutoLoginToken(token);
    const [rows] = await db.execute(queries.GET_AUTO_LOGIN_LINK_BY_TOKEN_HASH, [
      tokenHash,
    ]);
    return rows?.[0] || null;
  }

  static async markAutoLoginLinkUsed(id) {
    await db.execute(queries.UPDATE_AUTO_LOGIN_LINK_USAGE, [id]);
  }

  static async listAutoLoginLinks() {
    const [rows] = await db.execute(queries.LIST_AUTO_LOGIN_LINKS);
    return rows || [];
  }

  static async disableAutoLoginLink(id) {
    await db.execute(queries.DISABLE_AUTO_LOGIN_LINK, [id]);
  }
}

module.exports = LoginService;
