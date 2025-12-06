module.exports = {
  GET_EMPLOYEES_BY_SUPERVISOR: `
    SELECT 
      e.employee_id,
      e.first_name,
      e.last_name,
      CONCAT(e.first_name, ' ', e.last_name) AS employee_name
    FROM employees e
    JOIN employee_professional p ON e.employee_id = p.employee_id
    WHERE p.supervisor_id = ?
      AND e.Org_id = (SELECT Org_id FROM employees WHERE employee_id = ?)
      AND e.status = 'Active'
    ORDER BY e.first_name, e.last_name;
  `,

  GET_ALL_EMPLOYEES: `
    SELECT 
      e.employee_id,
      e.first_name,
      e.last_name,
      CONCAT(e.first_name, ' ', e.last_name) AS employee_name
    FROM employees e
    WHERE e.Org_id = (SELECT Org_id FROM employees WHERE employee_id = ?)
      AND e.status = 'Active'
    ORDER BY e.first_name, e.last_name;
  `,

  GET_TASKS_BY_SUPERVISOR: `
    SELECT 
      t.task_id,
      t.week_id,
      t.task_date,
      t.project_id,
      t.project_name,
      t.task_name,
      t.replacement_task,
      t.employee_id,
      CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
      t.emp_status,
      t.emp_comment,
      t.sup_status,
      t.sup_comment,
      t.sup_review_status,
      t.star_rating,
      t.created_at,
      t.updated_at,
      t.parent_task_id
    FROM weekly_tasks t
    JOIN employee_professional p ON t.employee_id = p.employee_id
    JOIN employees e ON t.employee_id = e.employee_id
    WHERE p.supervisor_id = ?
      AND e.Org_id = (SELECT Org_id FROM employees WHERE employee_id = ?)
      AND e.status = 'Active'
    ORDER BY t.task_date DESC, t.task_id ASC;
  `,

  GET_ALL_TASKS: `
    SELECT 
      t.task_id,
      t.week_id,
      t.task_date,
      t.project_id,
      t.project_name,
      t.task_name,
      t.replacement_task,
      t.employee_id,
      CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
      t.emp_status,
      t.emp_comment,
      t.sup_status,
      t.sup_comment,
      t.sup_review_status,
      t.star_rating,
      t.created_at,
      t.updated_at,
      t.parent_task_id
    FROM weekly_tasks t
    JOIN employees e ON t.employee_id = e.employee_id
    WHERE e.Org_id = (SELECT Org_id FROM employees WHERE employee_id = ?)
      AND e.status = 'Active'
    ORDER BY t.task_date DESC, t.task_id ASC;
  `,

  UPDATE_TASK_BY_ID: `
    UPDATE weekly_tasks
    SET sup_status = ?,
        sup_comment = ?,
        sup_review_status = ?,
        replacement_task = ?,
        star_rating = ?,
        project_id = ?,
        project_name = ?
    WHERE task_id = ?;
  `,

  INSERT_NEW_TASK: `
    INSERT INTO weekly_tasks (
      week_id, task_date, project_id, project_name, task_name,
      employee_id, emp_status, sup_status, emp_comment,
      sup_comment, sup_review_status, star_rating, parent_task_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `,

  GET_CONFIG: `
    SELECT \`key\`, \`value\`
    FROM config
    WHERE org_id IS NULL OR org_id = ?;
  `,

  UPDATE_CONFIG: `
    UPDATE config
    SET value = ?
    WHERE \`key\` = ?
      AND (org_id IS NULL OR org_id = ?);
  `,

  GET_HOLIDAYS: `
    SELECT id, date, occasion, type
    FROM holidays
    WHERE org_id IS NULL OR org_id = ?
    ORDER BY date ASC;
  `,
};
