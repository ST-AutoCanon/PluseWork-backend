module.exports = {
  GET_ATTENDANCE_RECORDS_BY_RANGE: `
    SELECT
      ea.punch_id,
      ea.employee_id,
      ea.punch_status,
      ea.punchin_time,
      ea.punchin_device,
      ea.punchin_location,
      ea.punchout_time,
      ea.punchout_device,
      ea.punchout_location,
      ea.punchmode,
      DATE(COALESCE(ea.punchin_time, ea.punchout_time)) AS attendance_date
    FROM emp_attendence ea
    JOIN employees e
      ON e.employee_id = ea.employee_id
    WHERE ea.employee_id = ?
      AND e.org_id = ?
      AND DATE(COALESCE(ea.punchin_time, ea.punchout_time)) BETWEEN ? AND ?
    ORDER BY attendance_date ASC, ea.punchin_time ASC, ea.punchout_time ASC
  `,

  GET_APPROVED_LEAVES_BY_RANGE: `
    SELECT
      l.employee_id,
      l.start_date,
      l.end_date,
      l.status
    FROM leavequeries l
    JOIN employees e
      ON e.employee_id = l.employee_id
    WHERE l.employee_id = ?
      AND e.org_id = ?
      AND l.status = 'Approved'
      AND l.start_date <= ?
      AND l.end_date >= ?
  `,

  GET_HOLIDAYS_BY_RANGE: `
    SELECT
      h.date
    FROM holidays h
    WHERE h.date BETWEEN ? AND ?
  `,

  GET_EXISTING_REQUEST_BY_PRIMARY_DATE: `
    SELECT
      id,
      employee_id,
      org_id,
      regularisation_type,
      primary_date,
      status
    FROM leave_regularisation_requests
    WHERE employee_id = ?
      AND org_id = ?
      AND regularisation_type = ?
      AND primary_date = ?
      AND status IN ('Pending', 'Approved')
    LIMIT 1
  `,

  INSERT_REGULARISATION_REQUEST: `
    INSERT INTO leave_regularisation_requests
      (org_id, employee_id, regularisation_type, selected_dates, primary_date, comment, status)
    VALUES (?, ?, ?, ?, ?, ?, 'Pending')
  `,

  GET_MY_REGULARISATION_REQUESTS: `
    SELECT
      l.id,
      l.org_id,
      l.employee_id,
      CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')) AS employee_name,
      l.regularisation_type,
      l.selected_dates,
      l.primary_date,
      l.comment,
      l.status,
      l.approver_comments,
      l.created_at,
      l.updated_at
    FROM leave_regularisation_requests l
    LEFT JOIN employees e
      ON e.employee_id = l.employee_id
    WHERE l.employee_id = ?
      AND l.org_id = ?
    ORDER BY l.created_at DESC
  `,

  GET_ALL_REGULARISATION_REQUESTS: `
    SELECT
      l.id,
      l.org_id,
      l.employee_id,
      CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')) AS employee_name,
      l.regularisation_type,
      l.selected_dates,
      l.primary_date,
      l.comment,
      l.status,
      l.approver_comments,
      l.created_at,
      l.updated_at
    FROM leave_regularisation_requests l
    LEFT JOIN employees e
      ON e.employee_id = l.employee_id
    WHERE l.org_id = ?
    ORDER BY l.created_at DESC
  `,

  GET_TEAM_REGULARISATION_REQUESTS_BY_DEPARTMENT: `
    SELECT DISTINCT
      l.id,
      l.org_id,
      l.employee_id,
      CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')) AS employee_name,
      l.regularisation_type,
      l.selected_dates,
      l.primary_date,
      l.comment,
      l.status,
      l.approver_comments,
      l.created_at,
      l.updated_at
    FROM leave_regularisation_requests l
    LEFT JOIN employees e
      ON e.employee_id = l.employee_id
    JOIN employee_professional pr
      ON pr.employee_id = l.employee_id
    JOIN employee_professional mypr
      ON mypr.employee_id = ?
    WHERE l.org_id = ?
      AND pr.department_id = mypr.department_id
      AND l.employee_id <> ?
    ORDER BY l.created_at DESC
  `,

  GET_TEAM_REGULARISATION_REQUESTS_BY_SUPERVISOR: `
    SELECT DISTINCT
      l.id,
      l.org_id,
      l.employee_id,
      CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')) AS employee_name,
      l.regularisation_type,
      l.selected_dates,
      l.primary_date,
      l.comment,
      l.status,
      l.approver_comments,
      l.created_at,
      l.updated_at
    FROM leave_regularisation_requests l
    LEFT JOIN employees e
      ON e.employee_id = l.employee_id
    JOIN employee_professional pr
      ON pr.employee_id = l.employee_id
    WHERE l.org_id = ?
      AND pr.supervisor_id = ?
      AND l.employee_id <> ?
    ORDER BY l.created_at DESC
  `,

  GET_REGULARISATION_REQUEST_BY_ID: `
    SELECT
      l.*,
      CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')) AS employee_name
    FROM leave_regularisation_requests l
    LEFT JOIN employees e
      ON e.employee_id = l.employee_id
    WHERE l.id = ?
      AND l.employee_id = ?
      AND l.org_id = ?
    LIMIT 1
  `,
};
