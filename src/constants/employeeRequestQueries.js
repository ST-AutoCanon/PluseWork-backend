module.exports = {
  // =========================================================
  // EMPLOYEE / HIERARCHY QUERIES
  // =========================================================

  GET_EMPLOYEE_INFO: `
    SELECT
      e.employee_id,
      e.org_id,
      e.status,
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
  // NOTIFICATIONS
  // =========================================================

  ADD_NOTIFICATION: `
    INSERT INTO notifications
    (
      user_id,
      message,
      triggered_at,
      is_read
    )
    VALUES
    (
      ?,
      ?,
      NOW(),
      0
    )
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
};
