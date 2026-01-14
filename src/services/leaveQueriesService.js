const queries = require("../constants/loginQueries");
const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");

async function getTenantPoolForOrgId(orgId) {
  if (!orgId) {
    const err = new Error("orgId is required to connect to tenant database");
    err.code = "ORG_REQUIRED";
    throw err;
  }

  const dbName = sanitizeDbName(`tenant_${orgId}`);
  return await getTenantPool(dbName);
}

class LeaveQueriesService {
  static async getLeaveQueriesForDashboard(employee_id, orgId) {
    let db;
    try {
      db = await getTenantPoolForOrgId(orgId);

      const [rows] = await db.execute(queries.GET_LEAVE_QUERIES_IN_DASHBOARD, [
        employee_id,
      ]);

      return rows || [];
    } catch (error) {
      console.error("❌ Error in getLeaveQueriesForDashboard:", {
        employee_id,
        orgId,
        error: error.message,
        code: error.code,
      });
      throw error;
    }
  }
}

module.exports = LeaveQueriesService;
