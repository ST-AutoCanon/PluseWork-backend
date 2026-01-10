


const queries = require("../constants/loginQueries"); // Note: consider renaming to leaveQueries if possible
const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");

/**
 * Helper to get tenant-specific pool based on orgId
 */
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
  /**
   * Fetches leave queries for the employee's dashboard
   * @param {string|number} employee_id
   * @param {string|number} orgId
   * @returns {Promise<Array>} List of leave queries
   */
  static async getLeaveQueriesForDashboard(employee_id, orgId) {
    let db;
    try {
      db = await getTenantPoolForOrgId(orgId);

      const [rows] = await db.execute(queries.GET_LEAVE_QUERIES_IN_DASHBOARD, [
        employee_id,
      ]);

      return rows || []; // Always return array, even if empty
    } catch (error) {
      console.error("❌ Error in getLeaveQueriesForDashboard:", {
        employee_id,
        orgId,
        error: error.message,
        code: error.code,
      });
      throw error; // Let controller handle HTTP response
    }
  }
}

module.exports = LeaveQueriesService;