const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");
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

async function getTenantPoolForOrgId(orgId) {
  if (!orgId) {
    const err = new Error("orgId required to get tenant pool");
    err.code = "ORG_REQUIRED";
    throw err;
  }
  const dbName = sanitizeDbName(`tenant_${orgId}`);
  return getTenantPool(dbName);
}

const fetchEmployeesBySupervisor = async (supervisorId, orgId) => {
  if (!orgId) throw new Error("orgId is required");
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(GET_EMPLOYEES_BY_SUPERVISOR, [
    supervisorId,
    supervisorId,
  ]);
  return rows;
};

const fetchAllEmployees = async (supervisorId, orgId) => {
  if (!orgId) throw new Error("orgId is required");
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(GET_ALL_EMPLOYEES, [supervisorId]);
  return rows;
};

const fetchTasksBySupervisor = async (supervisorId, orgId) => {
  if (!orgId) throw new Error("orgId is required");
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(GET_TASKS_BY_SUPERVISOR, [
    supervisorId,
  ]);
  return rows;
};

const fetchAllTasks = async (supervisorId, orgId) => {
  if (!orgId) throw new Error("orgId is required");
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(GET_ALL_TASKS, [supervisorId]);
  return rows;
};

const updateTaskById = async (taskId, updateData, orgId) => {
  if (!orgId) throw new Error("orgId is required");

  const {
    sup_status,
    sup_comment,
    sup_review_status,
    replacement_task,
    star_rating,
    project_id,
    project_name,
    action_by,
  } = updateData;

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    const [result] = await conn.query(UPDATE_TASK_BY_ID, [
      sup_status || "incomplete",
      sup_comment || null,
      sup_review_status || "pending",
      replacement_task || null,
      star_rating || 0,
      project_id || null,
      project_name || null,
      action_by || null,
      taskId,
    ]);

    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    console.error("❌ updateTaskById error:", err);
    throw err;
  } finally {
    conn.release();
  }
};
const insertNewTask = async (taskData, orgId) => {
  if (!orgId) throw new Error("orgId is required");

  const {
    week_id,
    task_date,
    project_id,
    project_name,
    task_name,
    employee_id,
      supervisor_id,

    emp_status,
    sup_status,
    emp_comment,
    sup_comment,
    sup_review_status,
    star_rating,
    parent_task_id,
  } = taskData;

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();
    const [result] = await conn.query(INSERT_NEW_TASK, [
      week_id,
      task_date,
      project_id,
      project_name,
      task_name,
      employee_id,
        supervisor_id,
      emp_status || "not started",
      sup_status || "incomplete",
      emp_comment || null,
      sup_comment || null,
      sup_review_status || "pending",
      star_rating || 0,
      parent_task_id || null,
      
    ]);
    await conn.commit();

    return {
      task_id: result.insertId,
      week_id,
      task_date,
      project_id,
      project_name,
      task_name,
      employee_id,
        supervisor_id,

      emp_status: emp_status || "not started",
      sup_status: sup_status || "incomplete",
      emp_comment,
      sup_comment,
      sup_review_status: sup_review_status || "pending",
      star_rating: star_rating || 0,
      parent_task_id,
    };
  } catch (err) {
    await conn.rollback();
    console.error("❌ insertNewTask error:", err);
    throw err;
  } finally {
    conn.release();
  }
};
const fetchConfig = async (supervisorId, orgId) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(GET_CONFIG, [orgId]);
  return rows;
};

const updateConfig = async (key, value, supervisorId, orgId) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  await tenantPool.query(UPDATE_CONFIG, [value, key, orgId]);
};

const fetchHolidays = async (supervisorId, orgId) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(GET_HOLIDAYS, [orgId]);
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
