

const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");
const queries = require("../constants/supervisorQueries");

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

const getEmployeesUnderSupervisor = async (supervisorId, orgId) => {
  if (!orgId) throw new Error("orgId is required");

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(queries.GET_EMPLOYEES_UNDER_SUPERVISOR, [
    supervisorId,
  ]);
  return rows;
};

const getEmployeeInteractions = async (employeeId, orgId) => {
  if (!orgId) throw new Error("orgId is required");

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(queries.GET_EMPLOYEE_INTERACTIONS, [
    employeeId,
  ]);
  return rows;
};

const updateSupervisorReplyById = async (interactionId, replyText, orgId) => {
  if (!orgId) throw new Error("orgId is required");

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `UPDATE task_interactions
       SET supervisor_reply = IF(supervisor_reply IS NULL OR supervisor_reply = '', ?, CONCAT(supervisor_reply, '\n', ?)),
           updated_at = CURRENT_TIMESTAMP
       WHERE interaction_id = ?`,
      [replyText, replyText, interactionId]
    );

    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    console.error("❌ updateSupervisorReplyById error:", err);
    throw err;
  } finally {
    conn.release();
  }
};

const insertSupervisorComment = async (employeeId, weekId, messageText, orgId) => {
  if (!orgId) throw new Error("orgId is required");

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    const [result] = await conn.query(queries.INSERT_SUPERVISOR_COMMENT, [
      employeeId,
      weekId,
      messageText,
    ]);

    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    console.error("❌ insertSupervisorComment error:", err);
    throw err;
  } finally {
    conn.release();
  }
};

// Optional: if you still need this direct reply method
const replyToEmployeeInteraction = async (interactionId, replyText, orgId) => {
  if (!orgId) throw new Error("orgId is required");

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [result] = await tenantPool.query(
    `UPDATE task_interactions SET supervisor_reply = ? WHERE interaction_id = ?`,
    [replyText, interactionId]
  );
  return result;
};

module.exports = {
  getEmployeesUnderSupervisor,
  getEmployeeInteractions,
  updateSupervisorReplyById,
  insertSupervisorComment,
  replyToEmployeeInteraction,
};