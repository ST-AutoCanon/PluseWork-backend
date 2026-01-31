const UPSERT_OVERTIME_DETAILS = `
  INSERT INTO overtime_details 
    (punch_id, work_date, employee_id, extra_hours, rate, project, supervisor, comments, status, approver_id, approver_name)
  VALUES 
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    extra_hours = VALUES(extra_hours),
    rate = VALUES(rate),
    project = VALUES(project),
    supervisor = VALUES(supervisor),
    comments = VALUES(comments),
    status = VALUES(status),
    approver_id = VALUES(approver_id),
    approver_name = VALUES(approver_name),
    updated_at = CURRENT_TIMESTAMP
`;

const GET_OVERTIME_STATUS_SUMMARY = `
  SELECT 
    employee_id,
    work_date,
    status,
    rate,
    project,
    supervisor,
    comments,
    approver_id,
    approver_name
  FROM overtime_details
  WHERE work_date >= ? AND work_date <= ? AND org_id = ?
`;

module.exports = {
  UPSERT_OVERTIME_DETAILS,
  GET_OVERTIME_STATUS_SUMMARY,
};
