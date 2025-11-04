const db = require("../config"); // your MySQL connection
const queries = require("../constants/taskMessagesQueries");



const createTaskMessage = async (taskId, messageObj) => {
  const jsonData = JSON.stringify({ messages: [messageObj] });
  await db.query(queries.INSERT_NEW_TASK_MESSAGE, [taskId, jsonData]);
};

// Append message (employee or supervisor)
const appendTaskMessage = async (taskId, messageObj) => {
  await db.query(queries.APPEND_TASK_MESSAGE, [JSON.stringify(messageObj), taskId]);
};

// Get all messages for task
const getTaskMessages = async (taskId) => {
  const [rows] = await db.query(queries.GET_TASK_MESSAGES, [taskId]);
  if (rows.length === 0) return null;

  const data = rows[0].message_data;
  return typeof data === "string" ? JSON.parse(data) : data;
};


module.exports = {
  createTaskMessage,
  appendTaskMessage,
  getTaskMessages,
  
};
