const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const { OVERTIME_SUMMARY_QUERY } = require("../constants/overtimeSummaryquerry");

/**
 * Fetch overtime summary for a supervisor from tenant database identified by orgId
 * @param {string} supervisorId
 * @param {string} orgId
 */
const getOvertimeSummaryService = async (supervisorId, orgId) => {
  if (!supervisorId) {
    const err = new Error("supervisorId is required");
    err.code = "MISSING_SUPERVISOR";
    throw err;
  }
  if (!orgId) {
    const err = new Error("orgId is required");
    err.code = "MISSING_ORG";
    throw err;
  }

  try {
    const tenantPool = await getTenantPoolByOrgId(orgId);
    const [rows] = await tenantPool.query(OVERTIME_SUMMARY_QUERY, [supervisorId]);
    return rows;
  } catch (err) {
    console.error("❌ getOvertimeSummaryService error:", err);
    throw err;
  }
};

module.exports = { getOvertimeSummaryService };
