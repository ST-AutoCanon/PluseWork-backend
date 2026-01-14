const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const {
  GET_EMPLOYEES_BY_SUPERVISOR_ORG,
} = require("../constants/supervisorEmployeesQueries");

const getEmployeesBySupervisorService = async (supervisorId, orgId) => {
  if (!orgId) throw new Error("orgId is required");

  const pool = await getTenantPoolByOrgId(orgId);

  const [rows] = await pool.query(GET_EMPLOYEES_BY_SUPERVISOR_ORG, [
    supervisorId,
  ]);
  return rows;
};

module.exports = { getEmployeesBySupervisorService };
