const GET_TASKS_BY_EMPLOYEE1 = `
  SELECT 
    task_id,
    employee_id,
    task_title,
    description,
    start_date,
    due_date,
    status,
    percentage,
    progress_percentage,
    created_at,
    updated_at
  FROM tasks
  WHERE employee_id = ?;
`;

module.exports = {
  GET_TASKS_BY_EMPLOYEE1,
};
