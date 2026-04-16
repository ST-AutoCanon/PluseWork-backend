const CLEARANCE_QUERIES = {

  GET_ITEMS: `
  SELECT
    id,
    org_id,
    exit_request_id,
    item_type,
    title,
    DATE_FORMAT(planned_date, '%Y-%m-%d') AS planned_date,
    description,
    DATE_FORMAT(actual_completed_date, '%Y-%m-%d') AS actual_completed_date,
    status,
    attached_files,
    supervisor_approved,
    supervisor_approved_at,
    supervisor_comment,
    hr_approved,
    hr_approved_at,
    hr_comment,
    
    created_by,
    created_at,
    updated_at
  FROM employee_exit_clearance_items
  WHERE org_id = ? AND exit_request_id = ?
  ORDER BY item_type, created_at
`,

  ADD_ITEM: `
    INSERT INTO employee_exit_clearance_items
    (
      org_id, exit_request_id, item_type, title,
      description, planned_date, status,
      attached_files, created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,

  UPDATE_STATUS: `
    UPDATE employee_exit_clearance_items
    SET
      status = ?,
      actual_completed_date = CASE
        WHEN ? = 'completed' THEN CURDATE()
        ELSE actual_completed_date
      END
    WHERE id = ? AND org_id = ?
  `,

  APPROVE_ITEM: `
    UPDATE employee_exit_clearance_items
    SET
      supervisor_approved     = CASE WHEN ? = 'supervisor' THEN 1 ELSE supervisor_approved END,
      supervisor_approved_at  = CASE WHEN ? = 'supervisor' THEN NOW() ELSE supervisor_approved_at END,
      supervisor_comment      = CASE WHEN ? = 'supervisor' THEN ? ELSE supervisor_comment END,

      hr_approved             = CASE WHEN ? = 'hr' THEN 1 ELSE hr_approved END,
      hr_approved_at          = CASE WHEN ? = 'hr' THEN NOW() ELSE hr_approved_at END,
      hr_comment              = CASE WHEN ? = 'hr' THEN ? ELSE hr_comment END
    WHERE id = ? AND org_id = ?
  `,

COUNT_PENDING_APPROVALS: `
  SELECT COUNT(*) AS pending
  FROM employee_exit_clearance_items
  WHERE exit_request_id = ?
    AND org_id = ?
    AND supervisor_approved = 0
`,
  FINALIZE_EXIT: `
    UPDATE employee_exit_requests1
    SET clearance_completed_at = NOW()
    WHERE id = ? AND org_id = ?
      AND clearance_completed_at IS NULL
      AND final_outcome = 'RESIGNED'
  `
};

module.exports = CLEARANCE_QUERIES;
