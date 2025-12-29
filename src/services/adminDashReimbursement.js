const {
  GET_APPROVED_REIMBURSEMENT_LAST_MONTH,
} = require("../constants/admindashreimbursement");
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

const getApprovedReimbursementLastMonth = async (orgId) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [result] = await tenantPool.query(
      GET_APPROVED_REIMBURSEMENT_LAST_MONTH
    );
    return result[0]?.total_approved_reimbursement_last_month || 0;
  } catch (error) {
    if (
      error &&
      (error.code === "ER_NO_SUCH_TABLE" ||
        error.code === "ER_BAD_DB_ERROR" ||
        error.code === "ER_DBACCESS_DENIED_ERROR")
    ) {
      const err = new Error(
        `Tenant schema for org ${orgId} is not provisioned or inaccessible`
      );
      err.code = "TENANT_SCHEMA";
      err.original = error && error.message ? error.message : error;
      throw err;
    }
    throw error;
  }
};

module.exports = {
  getApprovedReimbursementLastMonth,
};
