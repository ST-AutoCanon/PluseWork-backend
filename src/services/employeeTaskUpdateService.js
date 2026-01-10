

const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");
const TASK_QUERIES = require("../constants/employeeTaskUpdateQueries");

/**
 * Get tenant-specific connection pool
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

/**
 * Update an employee's task in the correct tenant database
 */
const updateEmployeeTask = async (taskId, status, percentage, progress_percentage, orgId) => {
  if (!orgId) throw new Error("orgId is required");
  if (!taskId) throw new Error("taskId is required");
  if (!status) throw new Error("status is required");

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    const [result] = await conn.query(TASK_QUERIES.UPDATE_EMPLOYEE_TASK, [
      status,
      percentage ?? null,         // allow null if not provided
      progress_percentage ?? null,
      taskId,
    ]);

    await conn.commit();

    if (result.affectedRows === 0) {
      throw new Error("Task not found or no changes made");
    }

    return result;
  } catch (err) {
    await conn.rollback();
    console.error("❌ updateEmployeeTask error:", err);
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = { updateEmployeeTask };