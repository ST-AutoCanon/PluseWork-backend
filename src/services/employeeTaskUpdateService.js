
const pool = require("../config");
const TASK_QUERIES = require("../constants/employeeTaskUpdateQueries");

const updateEmployeeTask = async (taskId, status, percentage, progress) => {
  const [result] = await pool.query(TASK_QUERIES.UPDATE_EMPLOYEE_TASK, [
    status,
    percentage,
    progress,
    taskId
  ]);
  return result;
};

module.exports = { updateEmployeeTask };
