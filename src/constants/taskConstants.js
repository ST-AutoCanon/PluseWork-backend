

const taskQueries = {
  insertTask: `
    INSERT INTO tasks (employee_id, task_title, description, start_date, due_date, status, percentage) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,

  getAllTasks: `
    SELECT * FROM tasks
  `,

  getTaskById: `
    SELECT * FROM tasks WHERE task_id = ?
  `,

  
  deleteTask: `
    DELETE FROM tasks WHERE task_id = ?
  `
};

module.exports = taskQueries;