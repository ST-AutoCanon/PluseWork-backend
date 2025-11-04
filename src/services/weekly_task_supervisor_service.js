

const db = require("../config");
const {
  GET_EMPLOYEES_BY_SUPERVISOR,
  GET_ALL_EMPLOYEES,
  GET_TASKS_BY_SUPERVISOR,
  GET_ALL_TASKS,
  UPDATE_TASK_BY_ID,
  INSERT_NEW_TASK,
  GET_CONFIG,
  UPDATE_CONFIG,
  GET_HOLIDAYS,
} = require("../constants/weeklyTaskSupervisorConstants");

// ── Employees ─────────────────────
const fetchEmployeesBySupervisor = async (supervisorId) => {
  const [rows] = await db.query(GET_EMPLOYEES_BY_SUPERVISOR, [supervisorId, supervisorId]);
  return rows;
};

const fetchAllEmployees = async (supervisorId) => {
  const [rows] = await db.query(GET_ALL_EMPLOYEES, [supervisorId]);
  return rows;
};

// ── Tasks ─────────────────────────
const fetchTasksBySupervisor = async (supervisorId) => {
  const [rows] = await db.query(GET_TASKS_BY_SUPERVISOR, [supervisorId, supervisorId]);
  return rows;
};

const fetchAllTasks = async (supervisorId) => {
  const [rows] = await db.query(GET_ALL_TASKS, [supervisorId]);
  return rows;
};

// ── Task mutations ─────────────────
const updateTaskById = async (taskId, updateData) => {
  const {
    sup_status,
    sup_comment,
    sup_review_status,
    replacement_task,
    star_rating,
    project_id,
    project_name,
  } = updateData;

  const [result] = await db.query(UPDATE_TASK_BY_ID, [
    sup_status || "incomplete",
    sup_comment || null,
    sup_review_status || "pending",
    replacement_task || null,
    star_rating || 0,
    project_id,
    project_name,
    taskId,
  ]);

  return result;
};

const insertNewTask = async (taskData) => {
  const {
    week_id,
    task_date,
    project_id,
    project_name,
    task_name,
    employee_id,
    emp_status,
    sup_status,
    emp_comment,
    sup_comment,
    sup_review_status,
    star_rating,
    parent_task_id,
  } = taskData;

  const [result] = await db.query(INSERT_NEW_TASK, [
    week_id,
    task_date,
    project_id,
    project_name,
    task_name,
    employee_id,
    emp_status || "not started",
    sup_status || "incomplete",
    emp_comment || null,
    sup_comment || null,
    sup_review_status || "pending",
    star_rating || 0,
    parent_task_id || null,
  ]);

  return {
    task_id: result.insertId,
    week_id,
    task_date,
    project_id,
    project_name,
    task_name,
    employee_id,
    emp_status: emp_status || "not started",
    sup_status: sup_status || "incomplete",
    emp_comment,
    sup_comment,
    sup_review_status: sup_review_status || "pending",
    star_rating: star_rating || 0,
    parent_task_id,
  };
};

// ── Config ────────────────────────
const fetchConfig = async (supervisorId) => {
  const [rows] = await db.query(GET_CONFIG, [supervisorId]);
  return rows;
};

const updateConfig = async (key, value, supervisorId) => {
  await db.query(UPDATE_CONFIG, [value, key, supervisorId]);
};

// ── Holidays ───────────────────────
const fetchHolidays = async (supervisorId) => {
  const [rows] = await db.query(GET_HOLIDAYS, [supervisorId]);
  return rows;
};

module.exports = {
  fetchEmployeesBySupervisor,
  fetchAllEmployees,
  fetchTasksBySupervisor,
  fetchAllTasks,
  updateTaskById,
  insertNewTask,
  fetchConfig,
  updateConfig,
  fetchHolidays,
};