module.exports = {
  CREATE_THREAD: `
    INSERT INTO threads (org_id, sender_id, recipient_id, subject, department_id, latest_message)
    VALUES (?, ?, ?, ?, ?, ?);
  `,

  ADD_MESSAGE: `
    INSERT INTO employee_queries (thread_id, sender_id, sender_role, message, attachment_url)
    VALUES (?, ?, ?, ?, ?);
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
    SET status = 'closed', feedback = ?, note = ?, updated_at = NOW()
    WHERE id = ?;
  `,

  GET_ALL_THREADS: `
SELECT
  t.id,
  t.sender_id,
  CONCAT(e.first_name, ' ', e.last_name) AS sender_name,
  p.photo_url,
  pr.role,
  p.gender,
  SUM(CASE WHEN mrs.is_read = 0 THEN 1 ELSE 0 END) AS unread_message_count,
  t.recipient_id,
  t.department_id,
  t.status,
  t.subject,
  t.latest_message,
  t.feedback,
  t.note,
  DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
  DATE_FORMAT(t.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
FROM threads t
JOIN employees e
  ON e.employee_id = t.sender_id
LEFT JOIN employee_personal p
  ON p.employee_id = e.employee_id
LEFT JOIN employee_professional pr
  ON pr.employee_id = e.employee_id
LEFT JOIN employee_queries q
  ON t.id = q.thread_id
LEFT JOIN message_read_status mrs
  ON q.id = mrs.message_id
WHERE t.org_id = ?
GROUP BY
  t.id,
  t.sender_id,
  sender_name,
  p.photo_url,
  pr.role,
  p.gender,
  t.recipient_id,
  t.department_id,
  t.status,
  t.subject,
  t.latest_message,
  t.feedback,
  t.note,
  created_at,
  updated_at
ORDER BY t.updated_at DESC;
`,

  GET_EMPLOYEE_BY_ROLE: `
    SELECT employee_id
    FROM employee_professional
    WHERE role = ?;
  `,

  GET_ORG_BY_EMPLOYEE: `
    SELECT org_id
    FROM employees
    WHERE employee_id = ?
    LIMIT 1
  `,

  GET_ADMIN: `
    SELECT ep.employee_id
    FROM employee_professional ep
    JOIN employees e ON ep.employee_id = e.employee_id
    WHERE ep.role = 'Admin'
      AND e.org_id = ?
      AND e.status = 'Active';
  `,

  GET_HR: `
    SELECT ep.employee_id
    FROM employee_professional ep
    JOIN employees e ON ep.employee_id = e.employee_id
    WHERE ep.role = 'Manager'
      AND ep.department_id = (
        SELECT id
        FROM departments
        WHERE name = 'HR' AND org_id = ?
        LIMIT 1
      )
      AND e.org_id = ?
      AND e.status = 'Active';
  `,

  GET_MANAGER_BY_DEPARTMENT: `
    SELECT ep.employee_id
    FROM employee_professional ep
    JOIN employees e ON ep.employee_id = e.employee_id
    WHERE ep.role = 'Manager'
      AND ep.department_id = ?
      AND e.org_id = ?
      AND e.status = 'Active';
  `,

  FETCH_THREADS: `
  SELECT
  t.id AS id,
  t.sender_id AS thread_sender_id,
  t.recipient_id AS thread_recipient_id,
  ANY_VALUE(t.subject) AS subject,
  ANY_VALUE(
    CASE
      WHEN t.sender_id = ? THEN t.recipient_id
      ELSE t.sender_id
    END
  ) AS counterpart_id,
  ANY_VALUE(CONCAT(e.first_name, ' ', e.last_name)) AS recipient_name,
  ANY_VALUE(p.photo_url) AS photo_url,
  ANY_VALUE(pr.role) AS role,
  ANY_VALUE(p.gender) AS gender,
  ANY_VALUE(t.department_id) AS department_id,
  ANY_VALUE(DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s')) AS created_at,
  ANY_VALUE(DATE_FORMAT(t.updated_at, '%Y-%m-%d %H:%i:%s')) AS updated_at,
  ANY_VALUE(t.status) AS status,
  ANY_VALUE(t.latest_message) AS latest_message,
  COUNT(CASE WHEN mrs.is_read = 0 THEN 1 END) AS unread_message_count

  FROM threads t

  JOIN employees e
    ON e.employee_id = (
      CASE
        WHEN t.sender_id = ? THEN t.recipient_id
        ELSE t.sender_id
      END
    )
  LEFT JOIN employee_personal p
    ON p.employee_id = e.employee_id
  LEFT JOIN employee_professional pr
    ON pr.employee_id = e.employee_id

  LEFT JOIN employee_queries q
    ON q.thread_id = t.id
  LEFT JOIN message_read_status mrs
    ON mrs.message_id = q.id
    AND mrs.recipient_id = ?

  WHERE t.sender_id   = ?
     OR t.recipient_id = ?

  GROUP BY t.id
  ORDER BY ANY_VALUE(t.created_at) DESC;
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

  UPDATE_LATEST_MESSAGE: `
    UPDATE threads
    SET latest_message = ?, updated_at = NOW()
    WHERE id = ?
  `,

  GET_THREAD_META: `
  SELECT id, sender_id, recipient_id, status, close_requested_at
  FROM threads
  WHERE id = ?
  LIMIT 1;
`,

  REQUEST_CLOSE_THREAD: `
  UPDATE threads
  SET status = 'pending_close',
      close_requested_by = ?,
      close_requested_at = NOW(),
      updated_at = NOW()
  WHERE id = ? AND status <> 'closed';
`,

  APPROVE_CLOSE_THREAD: `
  UPDATE threads
  SET status = 'closed',
      feedback = ?,
      closed_by = ?,
      closed_at = NOW(),
      updated_at = NOW()
  WHERE id = ? AND status = 'pending_close';
`,

  REOPEN_THREAD: `
  UPDATE threads
  SET status = 'open',
      close_requested_by = NULL,
      close_requested_at = NULL,
      updated_at = NOW()
  WHERE id = ? AND status = 'pending_close';
`,

  AUTO_CLOSE_EXPIRED_THREADS: `
  UPDATE threads
  SET status = 'closed',
      auto_closed = 1,
      closed_by = NULL,
      closed_at = NOW(),
      updated_at = NOW()
  WHERE org_id = ?
    AND status = 'pending_close'
    AND close_requested_at IS NOT NULL
    AND close_requested_at <= DATE_SUB(NOW(), INTERVAL 2 DAY);
`,

  GET_ALL_ORG_IDS: `
  SELECT id
  FROM organizations
  WHERE db_name IS NOT NULL AND db_name <> ''
`,
};
