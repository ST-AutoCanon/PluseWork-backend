
const db = require("../config");
const { GET_EMPLOYEES_BY_SUPERVISOR } = require("../constants/supervisorEmployeesQueries");

const getEmployeesBySupervisorService = async (supervisorId) => {
    const [rows] = await db.query(GET_EMPLOYEES_BY_SUPERVISOR, [supervisorId]);
    return rows;
};

module.exports = { getEmployeesBySupervisorService };
