const pool = require("../config");
const { GET_TASKS_BY_EMPLOYEE1 } = require("../constants/taskEmployeesQueries");

const getTasksByEmployee1 = async (employeeId) => {
  try {
    const [rows] = await pool.query(GET_TASKS_BY_EMPLOYEE1, [employeeId]);

    return rows;
  } catch (error) {
    console.error("Error in getTasksByEmployee:", error);
    throw error;
  }
};

module.exports = { getTasksByEmployee1 };
