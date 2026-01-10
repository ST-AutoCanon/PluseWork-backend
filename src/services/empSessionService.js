const attendanceQueries = require("../constants/attendanceQueries");
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

const attendanceService = {
  getTodayPunchRecords: async (employeeId, orgId) => {
    try {
      const db = await getTenantPoolForOrgId(orgId);
      const [rows] = await db.execute(
        attendanceQueries.GET_TODAY_PUNCH_RECORDS,
        [employeeId]
      );
      return rows;
    } catch (error) {
      console.error("Error fetching today's punch records:", error);
      throw error;
    }
  },
};

module.exports = attendanceService;
