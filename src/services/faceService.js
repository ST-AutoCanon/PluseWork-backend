const {
  GET_EMPLOYEE_NAME,
  INSERT_FACE_DATA,
} = require("../constants/faceQueries");

const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");

async function getEmployeeName(orgId, employee_id) {
  const tenantDb = await getTenantPoolByOrgId(orgId);

  const [rows] = await tenantDb.query(GET_EMPLOYEE_NAME, [employee_id]);
  return rows.length > 0 ? rows[0].first_name : null;
}

async function saveFaceData(orgId, employee_id, label, descriptors) {
  const tenantDb = await getTenantPoolByOrgId(orgId);

  return tenantDb.query(INSERT_FACE_DATA, [
    employee_id,
    label,
    JSON.stringify(descriptors),
  ]);
}

module.exports = {
  getEmployeeName,
  saveFaceData,
};
