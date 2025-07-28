module.exports = {
  /* employee-queries */
  CREATE_THREAD: `
  INSERT INTO threads (sender_id, recipient_id, subject, department_id) 
  VALUES (?, ?, ?, ?)
  `,

  ADD_MESSAGE: `
  INSERT INTO employee_queries (thread_id, sender_id, sender_role, message, attachment_url)
  VALUES (?, ?, ?, ?, ?)
  `,

  GET_THREAD_MESSAGES: `
    SELECT 
    eq.id, 
    eq.sender_id, 
    CONCAT(e.first_name, ' ', e.last_name) AS sender_name, 
    eq.sender_role, 
    eq.message, 
    eq.created_at, 
    eq.attachment_url 
  FROM 
    employee_queries eq
  JOIN 
    employees e ON e.employee_id = eq.sender_id
  WHERE 
    eq.thread_id = ?
  ORDER BY 
    eq.created_at ASC;
  
  `,

  CLOSE_THREAD: `
  UPDATE threads 
  SET status = 'closed', feedback = ?, note = ? 
  WHERE id = ?
  `,

  GET_ALL_THREADS: `
  SELECT 
  t.id, 
  t.sender_id, 
  CONCAT(e.first_name, ' ', e.last_name) AS sender_name,
  e.photo_url,
  e.role,
  e.gender,
  COUNT(CASE WHEN mrs.is_read = FALSE THEN 1 ELSE NULL END) AS unread_message_count, 
  t.recipient_id, 
  t.department_id, 
  t.status,
  t.subject,
  t.latest_message, 
  t.feedback,
  t.note, 
  t.created_at, 
  t.updated_at 
FROM 
  threads t
JOIN
  employees e ON e.employee_id = t.sender_id
LEFT JOIN 
  employee_queries q ON t.id = q.thread_id
LEFT JOIN 
  message_read_status mrs ON q.id = mrs.message_id
GROUP BY 
  t.id, 
  t.sender_id, 
  e.first_name, 
  e.last_name,
  e.photo_url,
  e.role,
  e.gender, 
  t.recipient_id, 
  t.department_id, 
  t.status, 
  t.subject, 
  t.latest_message, 
  t.feedback, 
  t.note, 
  t.created_at, 
  t.updated_at
ORDER BY 
  t.updated_at DESC;
  `,

  GET_EMPLOYEE_BY_ROLE: `
  SELECT 
    employee_id 
  FROM 
    employees 
  WHERE 
    role = ?
  `,

  GET_MANAGER_BY_DEPARTMENT: `
  SELECT 
    employee_id 
  FROM 
    employees 
  WHERE 
    role = 'Manager' AND department_id = ?
  `,

  FETCH_THREADS: `
  SELECT 
      t.id, 
      t.subject, 
      CONCAT(e.first_name, ' ', e.last_name) AS recipient_name,
      e.photo_url,
      e.role,
      e.gender,
      t.department_id,
      t.recipient_id, 
      t.created_at,
      t.updated_at, 
      t.status, 
      t.latest_message,
      COUNT(CASE WHEN mrs.is_read = FALSE THEN 1 ELSE NULL END) AS unread_message_count
  FROM threads t
  JOIN employees e ON e.employee_id = 
      CASE 
          WHEN t.sender_id = ? THEN t.recipient_id 
          ELSE t.sender_id 
      END
  LEFT JOIN employee_queries q ON t.id = q.thread_id
  LEFT JOIN message_read_status mrs ON q.id = mrs.message_id AND mrs.recipient_id = ?
  WHERE t.sender_id = ? OR t.recipient_id = ?
  GROUP BY 
      t.id, 
      t.subject, 
      e.first_name, 
      e.last_name, 
      e.photo_url,
      e.role,
      e.gender,
      t.department_id,
      t.recipient_id, 
      t.created_at, 
      t.updated_at, 
      t.status, 
      t.latest_message
  ORDER BY t.created_at DESC;

  `,

  MARK_MESSAGES_AS_READ: `
  UPDATE message_read_status
  SET is_read = TRUE, read_at = NOW()
  WHERE message_id IN (
      SELECT id FROM employee_queries WHERE thread_id = ?
  ) AND recipient_id = ?
  AND is_read = FALSE;
`,

  MARK_MESSAGES_AS_READ_ADMIN: `
  UPDATE message_read_status
  SET is_read = TRUE, read_at = NOW()
  WHERE message_id IN (
      SELECT id FROM employee_queries WHERE thread_id = ?
  ) AND is_read = FALSE;
`,

  UNREAD_STATUS: `
  INSERT INTO message_read_status (message_id, recipient_id, is_read) VALUES ?
  `,

  GET_ADMIN: `SELECT employee_id FROM employees WHERE role = 'Admin'`,
  GET_HR: `SELECT employee_id FROM employees WHERE role = 'HR'`,

  UPDATE_LATEST_MESSAGE: `
    UPDATE threads
    SET latest_message = ?, updated_at = NOW()
    WHERE id = ?
  `,
};
