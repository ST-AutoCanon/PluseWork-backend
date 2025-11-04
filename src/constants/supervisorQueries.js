

module.exports = {
  GET_EMPLOYEES_UNDER_SUPERVISOR: `
    SELECT ep.employee_id, ep.position, CONCAT(e.first_name, ' ', e.last_name) AS name
    FROM employee_professional ep
    JOIN employees e ON ep.employee_id = e.employee_id
    WHERE ep.supervisor_id = ?`,

  GET_EMPLOYEE_INTERACTIONS: `
    SELECT interaction_id, week_id, sender_role, message_text, supervisor_reply, created_at
    FROM task_interactions
    WHERE employee_id = ?
    ORDER BY created_at ASC`,

  
  UPDATE_SUPERVISOR_COMMENT: `
    UPDATE task_interactions
    SET supervisor_reply = ?
    WHERE interaction_id = ? AND sender_role = 'employee'`
};
