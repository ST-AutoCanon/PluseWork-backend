

const queries = require("../constants/taskMessagesQueries");
const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");

const createTaskMessage = async (orgId, taskId, messageObj) => {
  const pool = await getTenantPoolByOrgId(orgId);
  const jsonData = JSON.stringify({ messages: [messageObj] });

  await pool.query(queries.INSERT_NEW_TASK_MESSAGE, [taskId, jsonData]);
};

const appendTaskMessage = async (orgId, taskId, messageObj) => {
  const pool = await getTenantPoolByOrgId(orgId);

  await pool.query(queries.APPEND_TASK_MESSAGE, [
    JSON.stringify(messageObj),
    taskId,
  ]);
};

const getTaskMessages = async (orgId, taskId) => {
  const pool = await getTenantPoolByOrgId(orgId);
  const [rows] = await pool.query(queries.GET_TASK_MESSAGES, [taskId]);

  if (rows.length === 0) return null;

  const data = rows[0].message_data;
  return typeof data === "string" ? JSON.parse(data) : data;
};

module.exports = {
  createTaskMessage,
  appendTaskMessage,
  getTaskMessages,
};

