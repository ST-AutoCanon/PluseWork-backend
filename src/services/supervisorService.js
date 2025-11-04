

const db = require("../config");
const queries = require("../constants/supervisorQueries");

const getEmployeesUnderSupervisor = async (supervisorId) => {
  const [rows] = await db.query(queries.GET_EMPLOYEES_UNDER_SUPERVISOR, [supervisorId]);
  return rows;
};

const getEmployeeInteractions = async (employeeId) => {
  const [rows] = await db.query(queries.GET_EMPLOYEE_INTERACTIONS, [employeeId]);
  return rows;
};


const updateSupervisorReplyById = async (interactionId, replyText) => {
  const [result] = await db.query(
    `UPDATE task_interactions
     SET supervisor_reply = IF(supervisor_reply IS NULL OR supervisor_reply = '', ?, CONCAT(supervisor_reply, '\n', ?)),
         updated_at = CURRENT_TIMESTAMP
     WHERE interaction_id = ?`,
    [replyText, replyText, interactionId]
  );
  return result;
};

// Insert new supervisor comment
const insertSupervisorComment = async (employeeId, weekId, messageText) => {
  const [result] = await db.query(queries.INSERT_SUPERVISOR_COMMENT, [employeeId, weekId, messageText]);
  return result;
};

// Update supervisor reply for an existing interaction
const replyToEmployeeInteraction = async (interactionId, replyText) => {
  const [result] = await db.query(
    `UPDATE task_interactions
     SET supervisor_reply = ?
     WHERE interaction_id = ?`,
    [replyText, interactionId]
  );
  return result;
};


module.exports = {
  getEmployeesUnderSupervisor,
  getEmployeeInteractions,
 updateSupervisorReplyById,
  insertSupervisorComment
};
