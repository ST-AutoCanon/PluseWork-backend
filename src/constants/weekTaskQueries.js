module.exports = {
  INSERT_WEEK_TASK: `
    INSERT INTO weekly_tasks
      (week_id, task_date, project_id, project_name, task_name, emp_status, emp_comment, sup_status, sup_comment, sup_review_status, employee_id, star_rating)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,

  GET_WEEK_TASKS_BY_WEEK: `
    SELECT * FROM weekly_tasks WHERE week_id = ?
  `,

  GET_WEEK_TASKS_BY_EMPLOYEE: `
    SELECT * FROM weekly_tasks WHERE employee_id = ?
  `,

  UPDATE_WEEK_TASK: `
    UPDATE weekly_tasks
    SET project_id=?, project_name=?, task_name=?, emp_status=?, emp_comment=?, sup_status=?, sup_comment=?, sup_review_status=?, employee_id=?, star_rating=?
    WHERE task_id=?
  `,

  DELETE_WEEK_TASK: `
    DELETE FROM weekly_tasks WHERE task_id = ?
  `
};
