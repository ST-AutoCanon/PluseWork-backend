const queries = require("../constants/attendanceQueries");
const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");

async function getTenantPoolForOrgId(orgId) {
  if (!orgId) {
    const err = new Error("orgId required to get tenant pool");
    err.code = "ORG_REQUIRED";
    throw err;
  }
  const dbName = sanitizeDbName(`tenant_${orgId}`);
  return getTenantPool(dbName);
}

class EmpAttendanceService {
  static async getAttendanceStats(employeeId, orgId) {
    try {
      const db = await getTenantPoolForOrgId(orgId);
      const [rows] = await db.execute(queries.GET_ATTENDANCE_STATS, [
        employeeId,
        employeeId,
        employeeId,
        employeeId,
      ]);

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error("Error fetching attendance stats:", error);
      throw error;
    }
  }
}

module.exports = EmpAttendanceService;
