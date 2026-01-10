

const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");
const taskQueries = require("../constants/taskConstants");

/**
 * Get tenant-specific pool
 */
async function getTenantPoolForOrgId(orgId) {
  if (!orgId) {
    const err = new Error("orgId required to get tenant pool");
    err.code = "ORG_REQUIRED";
    throw err;
  }
  const dbName = sanitizeDbName(`tenant_${orgId}`);
  return getTenantPool(dbName);
}

const createTask = async (taskData, orgId) => {
  if (!orgId) throw new Error("orgId is required");

  const { employee_id, task_title, description, start_date, due_date, status, percentage } = taskData;

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    const [result] = await conn.query(taskQueries.insertTask, [
      employee_id,
      task_title,
      description,
      start_date,
      due_date,
      status || "pending",
      percentage || 0,
    ]);

    await conn.commit();
    return result.insertId;
  } catch (err) {
    await conn.rollback();
    console.error("❌ createTask error:", err);
    throw err;
  } finally {
    conn.release();
  }
};

const getAllTasks = async (orgId) => {
  if (!orgId) throw new Error("orgId is required");

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(taskQueries.getAllTasks);
  return rows;
};

const getTaskById = async (taskId, orgId) => {
  if (!orgId) throw new Error("orgId is required");

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(taskQueries.getTaskById, [taskId]);
  return rows[0] || null;
};

const deleteTask = async (taskId, orgId) => {
  if (!orgId) throw new Error("orgId is required");

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    const [result] = await conn.query(taskQueries.deleteTask, [taskId]);

    await conn.commit();
    return result.affectedRows;
  } catch (err) {
    await conn.rollback();
    console.error("❌ deleteTask error:", err);
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = {
  createTask,
  getAllTasks,
  getTaskById,
  deleteTask,
};