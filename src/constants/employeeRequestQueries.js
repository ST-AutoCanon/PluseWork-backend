module.exports = {
  // =========================================================
  // EMPLOYEE / HIERARCHY QUERIES
  // =========================================================

  GET_EMPLOYEE_INFO: `
    SELECT
      e.employee_id,
      e.org_id,
      e.status,
      e.phone_number,
      p.aadhaar_number,
      CONCAT(
        COALESCE(e.first_name, ''),
        ' ',
        COALESCE(e.last_name, '')
      ) AS employee_name,
      ep.role,
      ep.department_id,
      ep.salary,

      COALESCE(
        (
          SELECT sa.supervisor_id
          FROM supervisor_assignments sa
          WHERE sa.employee_id = e.employee_id
            AND sa.start_date <= CURDATE()
            AND (
              sa.end_date IS NULL
              OR sa.end_date >= CURDATE()
            )
          ORDER BY sa.start_date DESC
          LIMIT 1
        ),
        ep.supervisor_id
      ) AS supervisor_id

    FROM employees e

    LEFT JOIN employee_professional ep
      ON ep.employee_id = e.employee_id

    LEFT JOIN employee_personal p
      ON p.employee_id = e.employee_id

    WHERE e.employee_id = ?

    LIMIT 1
  `,

  GET_EMPLOYEE_BY_ID: `
    SELECT
      e.employee_id,

      CONCAT(
        COALESCE(e.first_name, ''),
        ' ',
        COALESCE(e.last_name, '')
      ) AS employee_name,

      ep.role,
      ep.department_id

    FROM employees e

    LEFT JOIN employee_professional ep
      ON ep.employee_id = e.employee_id

    WHERE e.employee_id = ?

    LIMIT 1
  `,

  GET_ADMIN: `
    SELECT
      ep.employee_id,

      CONCAT(
        COALESCE(e.first_name, ''),
        ' ',
        COALESCE(e.last_name, '')
      ) AS employee_name,

      ep.role

    FROM employee_professional ep

    JOIN employees e
      ON e.employee_id = ep.employee_id

    WHERE ep.role = 'Admin'
      AND e.org_id = ?
      AND e.status = 'Active'

    ORDER BY e.employee_id

    LIMIT 1
  `,

  GET_ACTIVE_EMPLOYEE_BY_ROLE: `
    SELECT
      ep.employee_id,
      CONCAT(
        COALESCE(e.first_name, ''),
        ' ',
        COALESCE(e.last_name, '')
      ) AS employee_name,
      ep.role
    FROM employee_professional ep
    JOIN employees e ON e.employee_id = ep.employee_id
    WHERE LOWER(REPLACE(ep.role, ' ', '')) LIKE CONCAT(LOWER(REPLACE(?, ' ', '')), '%')
      AND e.org_id = ?
      AND e.status = 'Active'
    ORDER BY e.employee_id
    LIMIT 1
  `,

  // =========================================================
  // THREAD / CHAT QUERIES
  // =========================================================

  CREATE_THREAD: `
    INSERT INTO threads
    (
      org_id,
      sender_id,
      recipient_id,
      department_id,
      status,
      subject,
      latest_message
    )
    VALUES
    (
      ?,
      ?,
      ?,
      ?,
      'open',
      ?,
      ?
    )
  `,

  CREATE_THREAD_MESSAGE: `
    INSERT INTO employee_queries
    (
      thread_id,
      sender_id,
      sender_role,
      message,
      attachment_url
    )
    VALUES
    (
      ?,
      ?,
      ?,
      ?,
      NULL
    )
  `,

  CREATE_MESSAGE_READ_STATUS: `
    INSERT INTO message_read_status
    (
      message_id,
      recipient_id,
      is_read
    )
    VALUES
    (
      ?,
      ?,
      0
    )
  `,

  UPDATE_THREAD_RECIPIENT: `
    UPDATE threads
    SET
      recipient_id = ?,
      latest_message = ?,
      updated_at = NOW()
    WHERE id = ?
  `,

  UPDATE_THREAD_AFTER_BOOKING: `
    UPDATE threads
    SET
      recipient_id = sender_id,
      latest_message = 'Travel tickets have been booked.',
      updated_at = NOW()
    WHERE id = ?
  `,

  CLOSE_THREAD_AFTER_COMPLETION: `
    UPDATE threads
    SET
      status = 'closed',
      latest_message = 'Trip completed.',
      updated_at = NOW(),
      closed_by = ?,
      closed_at = NOW()
    WHERE id = ?
  `,

  CLOSE_THREAD_AFTER_REJECTION: `
    UPDATE threads
    SET
      status = 'closed',
      latest_message = ?,
      updated_at = NOW(),
      closed_by = ?,
      closed_at = NOW()
    WHERE id = ?
  `,

  GET_THREAD_MESSAGES: `
    SELECT
      q.id,
      q.thread_id,
      q.sender_id,
      q.sender_role,
      q.message,
      q.attachment_url,
      q.created_at,

      CONCAT(
        COALESCE(e.first_name, ''),
        ' ',
        COALESCE(e.last_name, '')
      ) AS sender_name

    FROM employee_queries q

    JOIN employees e
      ON e.employee_id = q.sender_id

    WHERE q.thread_id = ?

    ORDER BY q.created_at ASC
  `,

  // =========================================================
  // EMPLOYEE REQUEST QUERIES
  // =========================================================

  CREATE_EMPLOYEE_REQUEST: `
    INSERT INTO employee_requests
    (
      request_code,
      org_id,
      employee_id,
      request_type,
      title,
      thread_id,
      current_status,
      current_stage,
      current_assignee_id,
      current_assignee_role,
      details_json
    )
    VALUES
    (
      'TEMP',
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?
    )
  `,

  UPDATE_REQUEST_CODE: `
    UPDATE employee_requests
    SET request_code = ?
    WHERE id = ?
  `,

  GET_REQUESTS_FOR_EMPLOYEE: `
    SELECT
      r.*,

      CONCAT(
        COALESCE(e.first_name, ''),
        ' ',
        COALESCE(e.last_name, '')
      ) AS employee_name

    FROM employee_requests r

    JOIN employees e
      ON e.employee_id = r.employee_id

    WHERE r.org_id = ?
      AND r.employee_id = ?

    ORDER BY r.updated_at DESC
  `,

  GET_PENDING_REQUESTS: `
    SELECT
      r.*,

      CONCAT(
        COALESCE(e.first_name, ''),
        ' ',
        COALESCE(e.last_name, '')
      ) AS employee_name,

      ep.role AS employee_role

    FROM employee_requests r

    JOIN employees e
      ON e.employee_id = r.employee_id

    LEFT JOIN employee_professional ep
      ON ep.employee_id = e.employee_id

    WHERE r.org_id = ?
      AND r.current_assignee_id = ?

    ORDER BY r.updated_at DESC
  `,

  GET_ASSIGNED_REQUEST_HISTORY: `
    SELECT
      r.*,

      CONCAT(
        COALESCE(e.first_name, ''),
        ' ',
        COALESCE(e.last_name, '')
      ) AS employee_name,

      ep.role AS employee_role

    FROM employee_requests r

    JOIN employees e
      ON e.employee_id = r.employee_id

    LEFT JOIN employee_professional ep
      ON ep.employee_id = e.employee_id

    WHERE r.org_id = ?
      AND (
        r.current_assignee_id = ?
        OR EXISTS (
          SELECT 1
          FROM employee_request_events ev
          WHERE ev.request_id = r.id
            AND ev.actor_id = ?
        )
      )

    ORDER BY r.updated_at DESC
  `,

  GET_TRAVEL_OPERATIONS: `
    SELECT
      r.*,
      CONCAT(
        COALESCE(e.first_name, ''),
        ' ',
        COALESCE(e.last_name, '')
      ) AS employee_name
    FROM employee_requests r
    JOIN employees e ON e.employee_id = r.employee_id
    WHERE r.org_id = ?
      AND r.request_type = 'TRAVEL_BOOKING'
    ORDER BY r.updated_at DESC
  `,

  GET_REQUEST_DETAIL: `
    SELECT
      r.*,

      CONCAT(
        COALESCE(e.first_name, ''),
        ' ',
        COALESCE(e.last_name, '')
      ) AS employee_name,

      ep.role AS employee_role,

      p.photo_url,
      p.gender,

      era.id AS e_ticket_attachment_id,
      era.file_name AS e_ticket_file_name,
      era.file_path AS e_ticket_file_path,
      era.mime_type AS e_ticket_mime_type,
      era.file_size AS e_ticket_file_size

    FROM employee_requests r

    JOIN employees e
      ON e.employee_id = r.employee_id

    LEFT JOIN employee_professional ep
      ON ep.employee_id = e.employee_id

    LEFT JOIN employee_personal p
      ON p.employee_id = e.employee_id

    LEFT JOIN employee_request_attachments era
      ON era.request_id = r.id
      AND era.purpose = 'E_TICKET'
      AND era.id = (
        SELECT MAX(x.id)
        FROM employee_request_attachments x
        WHERE x.request_id = r.id
          AND x.purpose = 'E_TICKET'
      )

    WHERE r.org_id = ?
      AND r.id = ?

    LIMIT 1
`,

  GET_REQUEST_FOR_UPDATE: `
    SELECT *
    FROM employee_requests
    WHERE org_id = ?
      AND id = ?
    LIMIT 1
    FOR UPDATE
  `,

  UPDATE_REQUEST_TO_ADMIN_ACTION: `
    UPDATE employee_requests
    SET
      current_status = 'PENDING_ADMIN_ACTION',
      current_stage = 'ADMIN_ACTION',
      current_assignee_id = ?,
      current_assignee_role = 'Admin'
    WHERE id = ?
  `,

  UPDATE_REQUEST_ASSIGNEE: `
    UPDATE employee_requests
    SET
      current_status = 'PENDING_APPROVAL',
      current_stage = ?,
      current_assignee_id = ?,
      current_assignee_role = ?
    WHERE id = ?
  `,

  UPDATE_REQUEST_TO_TRAVEL_DESK: `
    UPDATE employee_requests
    SET
      current_status = 'PENDING_ADMIN_ACTION',
      current_stage = 'TRAVEL_DESK_ACTION',
      current_assignee_id = ?,
      current_assignee_role = ?
    WHERE id = ?
  `,

  UPDATE_REQUEST_TO_BOOKED: `
    UPDATE employee_requests
    SET
      details_json = ?,
      current_status = 'BOOKED',
      current_stage = 'EMPLOYEE_CONFIRMATION',
      current_assignee_id = employee_id,
      current_assignee_role = 'Employee'
    WHERE id = ?
  `,

  UPDATE_REQUEST_TO_COMPLETED: `
    UPDATE employee_requests
    SET
      current_status = 'COMPLETED',
      current_stage = 'COMPLETED',
      current_assignee_id = NULL,
      current_assignee_role = NULL,
      completed_at = NOW()
    WHERE id = ?
  `,

  UPDATE_REQUEST_TO_REJECTED: `
    UPDATE employee_requests
    SET
      current_status = 'REJECTED',
      current_stage = 'COMPLETED',
      current_assignee_id = NULL,
      current_assignee_role = NULL,
      completed_at = NOW()
    WHERE id = ?
  `,

  UPDATE_REQUEST_TO_CANCELLED: `
    UPDATE employee_requests
    SET
      current_status = 'CANCELLED',
      current_stage = 'COMPLETED',
      current_assignee_id = NULL,
      current_assignee_role = NULL,
      completed_at = NOW()
    WHERE id = ?
  `,

  UPDATE_TRAVEL_BOOKING_DRAFT: `
    UPDATE employee_requests
    SET details_json = ?
    WHERE org_id = ?
      AND id = ?
      AND request_type = 'TRAVEL_BOOKING'
      AND current_status = 'PENDING_ADMIN_ACTION'
  `,

  CANCEL_THREAD: `
    UPDATE threads
    SET
      status = 'closed',
      latest_message = ?,
      updated_at = NOW(),
      closed_by = ?,
      closed_at = NOW()
    WHERE id = ? AND status <> 'closed'
  `,

  GET_REMINDER_REQUESTS: `
    SELECT id, request_code, title, employee_id, current_assignee_id
    FROM employee_requests
    WHERE org_id = ?
      AND current_status IN ('PENDING_APPROVAL', 'PENDING_ADMIN_ACTION')
      AND updated_at <= DATE_SUB(NOW(), INTERVAL 1 DAY)
  `,

  GET_ALL_ORG_IDS: `
    SELECT id
    FROM organizations
    WHERE db_name IS NOT NULL AND db_name <> ''
  `,

  // =========================================================
  // REQUEST EVENTS
  // =========================================================

  ADD_REQUEST_EVENT: `
    INSERT INTO employee_request_events
    (
      request_id,
      event_type,
      stage,
      actor_id,
      actor_role,
      message,
      metadata
    )
    VALUES
    (
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?
    )
  `,

  GET_REQUEST_EVENTS: `
    SELECT
      ev.*,

      CONCAT(
        COALESCE(e.first_name, ''),
        ' ',
        COALESCE(e.last_name, '')
      ) AS actor_name

    FROM employee_request_events ev

    LEFT JOIN employees e
      ON e.employee_id = ev.actor_id

    WHERE ev.request_id = ?

    ORDER BY ev.created_at ASC
  `,

  // =========================================================
  // REQUEST ATTACHMENTS
  // =========================================================

  CREATE_REQUEST_ATTACHMENT: `
    INSERT INTO employee_request_attachments
    (
      request_id,
      uploaded_by,
      file_name,
      file_path,
      mime_type,
      file_size,
      purpose
    )
    VALUES
    (
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?
    )
  `,

  UPDATE_REQUEST_TO_COMPLETED_WITH_DETAILS: `
    UPDATE employee_requests
    SET
      details_json = ?,
      current_status = 'COMPLETED',
      current_stage = 'COMPLETED',
      current_assignee_id = NULL,
      current_assignee_role = NULL,
      completed_at = NOW()
    WHERE id = ?
  `,

  GET_REQUEST_ATTACHMENTS: `
    SELECT id, request_id, uploaded_by, file_name, file_path, mime_type, file_size, purpose
    FROM employee_request_attachments
    WHERE request_id = ?
    ORDER BY id ASC
  `,

  GET_REQUEST_ATTACHMENT: `
    SELECT id, request_id, uploaded_by, file_name, file_path, mime_type, file_size, purpose
    FROM employee_request_attachments
    WHERE request_id = ? AND id = ?
    LIMIT 1
  `,

  ADD_EMPLOYEE_ADVANCE: `
    INSERT INTO employee_advance_details
    (
      employee_id,
      advance_amount,
      recovery_months,
      applicable_months,
      created_at
    )
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `,

  // =========================================================
  // EMPLOYEE SERVICES NOTIFICATIONS
  // =========================================================

  ADD_SERVICE_NOTIFICATION: `
  INSERT INTO employee_service_notifications
  (
    request_id,
    user_id,
    notification_type,
    title,
    message,
    metadata,
    is_read,
    created_at
  )
  VALUES
  (
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    0,
    NOW()
  )
`,

  GET_SERVICE_NOTIFICATIONS: `
  SELECT
    n.id,
    n.request_id,
    n.user_id,
    n.notification_type,
    n.title,
    n.message,
    n.metadata,
    n.is_read,
    n.read_at,
    n.created_at,

    r.request_code,
    r.request_type,
    r.title AS request_title,
    r.current_status,
    r.current_stage

  FROM employee_service_notifications n

  LEFT JOIN employee_requests r
    ON r.id = n.request_id

  WHERE n.user_id = ?

  ORDER BY n.created_at DESC
  LIMIT ?
`,

  GET_UNREAD_SERVICE_NOTIFICATION_COUNT: `
  SELECT COUNT(*) AS count
  FROM employee_service_notifications
  WHERE user_id = ?
    AND notification_type = 'NOTIFICATION'
    AND is_read = 0
`,

  GET_UNREAD_SERVICE_REMINDER_COUNT: `
  SELECT COUNT(*) AS count
  FROM employee_service_notifications
  WHERE user_id = ?
    AND notification_type = 'REMINDER'
    AND is_read = 0
`,

  MARK_SERVICE_NOTIFICATION_READ: `
  UPDATE employee_service_notifications
  SET
    is_read = 1,
    read_at = NOW()
  WHERE id = ?
    AND user_id = ?
`,

  MARK_ALL_SERVICE_NOTIFICATIONS_READ: `
  UPDATE employee_service_notifications
  SET
    is_read = 1,
    read_at = NOW()
  WHERE user_id = ?
    AND notification_type = 'NOTIFICATION'
    AND is_read = 0
`,

  GET_SERVICE_REMINDER_REQUESTS_FOR_USER: `
  SELECT
    r.id,
    r.request_code,
    r.request_type,
    r.title,
    r.current_status,
    r.current_stage,
    r.current_assignee_id,
    r.updated_at,
    r.created_at

  FROM employee_requests r

  WHERE r.org_id = ?
    AND r.current_assignee_id = ?
    AND r.current_status IN (
      'PENDING_APPROVAL',
      'PENDING_ADMIN_ACTION'
    )

  ORDER BY r.updated_at ASC
`,

  GET_EMPLOYEE_SERVICE_OVERVIEW: `
  SELECT
    COUNT(*) AS total_requests,

    SUM(
      CASE
        WHEN employee_id = ?
        THEN 1
        ELSE 0
      END
    ) AS my_requests,

    SUM(
      CASE
        WHEN employee_id = ?
         AND current_status IN (
           'PENDING_APPROVAL',
           'PENDING_ADMIN_ACTION'
         )
        THEN 1
        ELSE 0
      END
    ) AS my_pending,

    SUM(
      CASE
        WHEN employee_id = ?
         AND current_status = 'COMPLETED'
        THEN 1
        ELSE 0
      END
    ) AS my_completed,

    SUM(
      CASE
        WHEN current_assignee_id = ?
         AND current_status IN (
           'PENDING_APPROVAL',
           'PENDING_ADMIN_ACTION'
         )
        THEN 1
        ELSE 0
      END
    ) AS assigned_pending

  FROM employee_requests
  WHERE org_id = ?
`,
};
