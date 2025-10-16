module.exports = {
  GET_ALL_REIMBURSEMENTS: `
  SELECT r.*,
         CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
         CONCAT(r.from_date, ' - ', r.to_date) AS tdate,
         IF(r.from_date IS NOT NULL AND r.to_date IS NOT NULL, 
            CONCAT(r.from_date, ' - ', r.to_date), 
            r.date) AS date_range,
         r.payment_status,
         r.paid_date
  FROM reimbursement r
  JOIN employees e ON r.employee_id = e.employee_id
  WHERE (? IS NULL OR (r.created_at >= ? AND r.created_at < DATE_ADD(?, INTERVAL 1 DAY)))
    AND r.org_id = ?
  ORDER BY r.created_at DESC
`,

  GET_TEAM_REIMBURSEMENTS: `
  SELECT r.*,
         CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
         CONCAT(r.from_date, ' - ', r.to_date) AS tdate,
         IF(r.from_date IS NOT NULL AND r.to_date IS NOT NULL, 
            CONCAT(r.from_date, ' - ', r.to_date), 
            r.date) AS date_range,
         r.paid_date
  FROM reimbursement r
  JOIN employees e ON r.employee_id = e.employee_id
  WHERE r.employee_id IN (
      SELECT employee_id FROM employees WHERE department_id = ?
  )
  AND (? IS NULL OR (r.created_at >= ? AND r.created_at < DATE_ADD(?, INTERVAL 1 DAY)))
  AND r.org_id = ?
  ORDER BY r.created_at DESC
`,

  GET_EMPLOYEE_DETAILS: `
  SELECT
    CONCAT(e.first_name, " ", e.last_name) AS name,
    ep.position,
    d.name AS department_name
  FROM employees e
  LEFT JOIN employee_professional ep
    ON e.employee_id = ep.employee_id
  LEFT JOIN departments d
    ON ep.department_id = d.id
  WHERE e.employee_id = ?
`,

  CREATE_REIMBURSEMENT: `
    INSERT INTO reimbursement (
      employee_id, department_id, claim_type, transport_type, from_date, to_date, date,
      travel_from, travel_to, meals_objective, purpose, purchasing_item, accommodation_fees,
      no_of_days, transport_amount, da, total_amount, meal_type, stationary, service_provider,
      project, org_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,

  CHECK_EXISTING_REIMBURSEMENT_SINGLE_DATE: `
    SELECT * FROM reimbursement 
    WHERE employee_id = ?
      AND claim_type = ?
      AND date = ?
      AND org_id = ?
  `,

  CHECK_EXISTING_REIMBURSEMENT_DATE_RANGE: `
    SELECT * FROM reimbursement 
    WHERE employee_id = ?
      AND claim_type = ?
      AND (
        (from_date BETWEEN ? AND ?) 
        OR 
        (to_date BETWEEN ? AND ?)
      )
      AND org_id = ?
  `,

  SAVE_ATTACHMENTS: `INSERT INTO reimbursement_attachments (reimbursement_id, file_name, file_path) VALUES ?`,

  CHECK_EXISTING_CLAIM: `
    SELECT * FROM reimbursement
    WHERE employee_id = ?
      AND claim_type = ?
      AND (
        (date IS NOT NULL AND date = ?)
        OR
        (from_date IS NOT NULL AND to_date IS NOT NULL AND NOT (to_date < ? OR from_date > ?))
      )
      AND org_id = ?
  `,

  UPDATE_REIMBURSEMENT: `
      UPDATE reimbursement 
      SET department_id=?, claim_type=?, transport_type=?, from_date=?, to_date=?, date=?, 
          travel_from=?, travel_to=?, meals_objective=?, purpose=?, purchasing_item=?, accommodation_fees=?, no_of_days=?, transport_amount=?, da=?, total_amount=?, 
          meal_type=?, stationary=?, service_provider=?, project=?
      WHERE id=? AND org_id = ?;
  `,

  GET_APPROVER_DETAILS: `
  SELECT
    CONCAT(e.first_name, ' ', e.last_name) AS name,
    ep.role
  FROM employees e
  JOIN employee_professional ep
    ON e.employee_id = ep.employee_id
  WHERE e.employee_id = ?;
  `,

  UPDATE_REIMBURSEMENT_STATUS: `
  UPDATE reimbursement
  SET status = ?, approver_comments = ?, approver_id = ?, approver_name = ?, approver_designation = ?, project = ?, approved_date = ?
  WHERE id = ? AND org_id = ?
  `,

  GET_REIMBURSEMENTS_BY_EMPLOYEE: `
    SELECT r.*, 
           CONCAT(r.from_date, ' - ', r.to_date) AS date_range
    FROM reimbursement r
    WHERE r.employee_id = ?
      AND r.org_id = ?
  `,

  DELETE_REIMBURSEMENT: `DELETE FROM reimbursement WHERE id=? AND org_id = ?`,

  GET_ATTACHMENTS_BY_REIMBURSEMENT_IDS: `
    SELECT ra.*, r.org_id as employee_org_id, r.employee_id
    FROM reimbursement_attachments ra
    LEFT JOIN reimbursement r ON ra.reimbursement_id = r.id
    WHERE ra.reimbursement_id IN (?)
  `,

  GET_ATTACHMENTS: `SELECT file_name, file_path FROM reimbursement_attachments WHERE reimbursement_id = ?`,

  GET_CLAIM_DETAILS: `
    SELECT * FROM reimbursement WHERE id = ? AND org_id = ?
  `,

  UPDATE_PAYMENT_STATUS: `
    UPDATE reimbursement
    SET payment_status = ?, paid_date = ?
    WHERE id = ? AND org_id = ?
  `,

  GET_ALL_PROJECTS: `
  SELECT project_name
  FROM add_project
  WHERE org_id = ?
  ORDER BY project_name;
`,

  DELETE_ATTACHMENTS_BY_REIMBURSEMENT_ID: `DELETE FROM reimbursement_attachments WHERE reimbursement_id = ?`,
};
