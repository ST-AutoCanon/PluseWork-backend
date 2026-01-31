const FETCH_PUNCHES_BY_DATE_RANGE = `
  SELECT 
    p.punch_id,
    p.employee_id,
    p.work_date,
    p.hours_worked,
    COALESCE(p.apportioned_hours, p.hours_worked) AS apportioned_hours,
    ep.project_names,
    ep.supervisor_name
  FROM punches p
  LEFT JOIN (
    SELECT 
      employee_id,
      GROUP_CONCAT(DISTINCT project_name SEPARATOR ', ') AS project_names,
      supervisor_name
    FROM employee_projects 
    GROUP BY employee_id
  ) ep ON p.employee_id = ep.employee_id
  WHERE p.work_date >= ? AND p.work_date < ?
  ORDER BY p.work_date, p.employee_id, p.punch_id
`;

const FETCH_OVERTIME_DETAILS_BY_PUNCHES = `
  SELECT 
    od.punch_id,
    od.status,
    od.rate,
    od.project,
    od.supervisor,
    od.comments
  FROM overtime_details od
  WHERE od.work_date >= ? AND od.work_date < ?
`;
const UPSERT_OVERTIME = `
  INSERT INTO overtime_details 
  (punch_id, work_date, employee_id, extra_hours, rate, project, supervisor, comments, status) 
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
  ON DUPLICATE KEY UPDATE 
    work_date = VALUES(work_date),
    employee_id = VALUES(employee_id),
    extra_hours = VALUES(extra_hours),
    rate = VALUES(rate),
    project = VALUES(project),
    supervisor = VALUES(supervisor),
    comments = VALUES(comments),
    status = VALUES(status),
    updated_at = CURRENT_TIMESTAMP
`;
const UPDATE_OVERTIME = `
  UPDATE overtime_details 
  SET 
    status = ?, 
    rate = COALESCE(?, rate), 
    project = COALESCE(?, project), 
    supervisor = COALESCE(?, supervisor), 
    comments = COALESCE(?, comments), 
    approver_id = COALESCE(?, approver_id),
    approver_name = COALESCE(?, approver_name),
    updated_at = CURRENT_TIMESTAMP 
  WHERE punch_id = ?
`;
module.exports = {
  UPDATE_OVERTIME,
  FETCH_PUNCHES_BY_DATE_RANGE,
  FETCH_OVERTIME_DETAILS_BY_PUNCHES,
  UPSERT_OVERTIME,
};
