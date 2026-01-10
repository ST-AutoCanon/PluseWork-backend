
const { GET_TASKS_BY_EMPLOYEE1 } = require("../constants/taskEmployeesQueries");
const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");

const getTasksByEmployee1 = async (employeeId, orgId) => {
  try {
    if (!employeeId) throw new Error("employeeId is required");
    if (!orgId) throw new Error("orgId is required");

    const tenantDb = await getTenantPoolByOrgId(orgId);

    const [rows] = await tenantDb.query(GET_TASKS_BY_EMPLOYEE1, [employeeId]);

    return rows;
  } catch (error) {
    console.error("Error in getTasksByEmployee1:", error.message);
    throw error;
  }
};

module.exports = { getTasksByEmployee1 };
