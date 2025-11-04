const db = require("../config");
const queries = require("../constants/weekTaskQueries");

exports.createWeekTask = async (taskData) => {
  const [result] = await db.query(queries.INSERT_WEEK_TASK, [
    taskData.week_id,
    taskData.task_date,
    taskData.project_id,
    taskData.project_name,
    taskData.task_name,
    taskData.emp_status || "not started",
    taskData.emp_comment || null,
    taskData.sup_status || "not started",
    taskData.sup_comment || null,
    taskData.sup_review_status || "pending",
    taskData.employee_id || null,
    taskData.star_rating || null
  ]);
  return result.insertId;
};

exports.getWeekTasksByWeek = async (week_id) => {
  const [rows] = await db.query(queries.GET_WEEK_TASKS_BY_WEEK, [week_id]);
  return rows;
};

// Fetch tasks by employee_id
exports.getWeekTasksByEmployee = async (employee_id) => {
  const [rows] = await db.query(queries.GET_WEEK_TASKS_BY_EMPLOYEE, [employee_id]);
  return rows;
};

exports.updateWeekTask = async (task_id, taskData) => {
  const [result] = await db.query(queries.UPDATE_WEEK_TASK, [
    taskData.project_id,
    taskData.project_name,
    taskData.task_name,
    taskData.emp_status,
    taskData.emp_comment,
    taskData.sup_status,
    taskData.sup_comment,
    taskData.sup_review_status,
    taskData.employee_id || null,
    taskData.star_rating || null,
    task_id
  ]);
  return result.affectedRows;
};

exports.deleteWeekTask = async (task_id) => {
  const [result] = await db.query(queries.DELETE_WEEK_TASK, [task_id]);
  return result.affectedRows;
};
