const queries = require("../constants/loginQueries");
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

const getReimbursementStats = async (employeeId, orgId) => {
  try {
    const db = await getTenantPoolForOrgId(orgId);
    const [rows] = await db.execute(queries.GET_REIMBURSEMENT_STATS, [
      employeeId,
    ]);
    return rows[0];
  } catch (error) {
    console.error("Error fetching reimbursement stats:", error);
    throw new Error("Database query failed");
  }
};

module.exports = {
  getReimbursementStats,
};
