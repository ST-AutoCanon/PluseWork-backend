        
const INSERT_NEW_TASK_MESSAGE = `
  INSERT INTO task_messages (task_id, message_data)
  VALUES (?, ?)
`;

const APPEND_TASK_MESSAGE = `
  UPDATE task_messages
  SET message_data = JSON_ARRAY_APPEND(
    message_data,
    '$.messages',
    CAST(? AS JSON)
  )
  WHERE task_id = ?
`;

const GET_TASK_MESSAGES = `
  SELECT message_data
  FROM task_messages
  WHERE task_id = ?
`;
module.exports = {
  INSERT_NEW_TASK_MESSAGE,
  APPEND_TASK_MESSAGE,
  GET_TASK_MESSAGES,
};