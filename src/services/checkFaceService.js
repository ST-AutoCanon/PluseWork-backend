// services/checkFaceService.js
const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const { CHECK_FACE_EXISTS } = require("../constants/checkFaceQuery");

/**
 * checkFaceExists(employee_id, orgId)
 * - orgId is required. This function will run the query against the tenant DB derived from orgId.
 */
const checkFaceExists = async (employee_id, orgId) => {
  if (!orgId) throw new Error("orgId required");
  if (!employee_id) return false;

  const tenantPool = await getTenantPoolByOrgId(orgId);
  const [rows] = await tenantPool.execute(CHECK_FACE_EXISTS, [employee_id]);
  return rows && rows.length > 0;
};

module.exports = {
  checkFaceExists,
};
