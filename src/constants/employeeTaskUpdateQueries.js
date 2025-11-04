
const TASK_QUERIES = {
  UPDATE_EMPLOYEE_TASK: `
    UPDATE tasks 
    SET status = ?, 
        percentage = ?, 
        progress_percentage = ?, 
        updated_at = CURRENT_TIMESTAMP
    WHERE task_id = ?
  `
};

module.exports = TASK_QUERIES;
