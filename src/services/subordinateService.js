const {
  getTenantPoolByOrgId,
} = require("../db/tenantPoolManager");

const {
  CHECK_EMPLOYEE_SUBORDINATES,
} = require("../constants/hasSubordinatesQuery");

const checkSubordinates = async (employeeId, orgId) => {
  // 🔥 Get tenant DB pool
  const tenantDb = await getTenantPoolByOrgId(orgId);

  const [rows] = await tenantDb.query(
    CHECK_EMPLOYEE_SUBORDINATES,
    [employeeId]
  );

  return rows[0].count > 0;
};

module.exports = {
  checkSubordinates,
};
