const db = require("../config");
const {
  GET_EMPLOYEE_PROJECTS,
} = require("../constants/employeeProjectsQueries");

const getEmployeeProjects = async () => {
  try {
    const [result] = await db.query(GET_EMPLOYEE_PROJECTS);
    return result;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getEmployeeProjects,
};
