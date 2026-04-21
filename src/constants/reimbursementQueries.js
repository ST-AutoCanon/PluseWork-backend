module.exports = {
  GET_ALL_REIMBURSEMENTS: `
    SELECT r.*, CONCAT(e.first_name, ' ', e.last_name) AS employee_name
    FROM reimbursement r
    JOIN employees e ON r.employee_id = e.employee_id
    WHERE (? IS NULL OR (r.created_at >= ? AND r.created_at < DATE_ADD(?, INTERVAL 1 DAY)))
    ORDER BY r.created_at DESC
  `,

  GET_EMPLOYEES: `
  SELECT e.employee_id,
         CONCAT(e.first_name, ' ', e.last_name) AS name,
         ep.position,
         d.name as department_name
  FROM employees e
  LEFT JOIN employee_professional ep ON e.employee_id = ep.employee_id
  LEFT JOIN departments d ON ep.department_id = d.id
  WHERE 1=1
  -- optional filters appended dynamically in service
`,

  GET_TEAM_REIMBURSEMENTS: `
  SELECT r.*,
         CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
         LOWER(TRIM(IFNULL(r.status, ''))) AS status,
         LOWER(TRIM(IFNULL(r.payment_status, ''))) AS payment_status,
         r.paid_date
  FROM reimbursement r
  JOIN employees e ON r.employee_id = e.employee_id
  WHERE r.employee_id IN (
      SELECT employee_id FROM employees WHERE department_id = ?
  )
  AND ( ? IS NULL OR r.employee_id <> ? ) -- exclude the team lead only when provided
  AND ( ? IS NULL OR (r.created_at >= ? AND r.created_at < DATE_ADD(?, INTERVAL 1 DAY)) )
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
    INSERT INTO reimbursement
      (employee_id, department_id, claim_type, transport_type, project, participants, comments, aggregated_total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,

  SAVE_REIMBURSEMENT_LINES_BULK: `
    INSERT INTO reimbursement_lines
      (reimbursement_id,
       line_index,
       purpose,
       date,
       from_date,
       to_date,
       travel_from,
       travel_to,
       transport_amount,
       accommodation_fees,
       da,
       total_amount,
       meal_type,
       meals_objective,
       purchasing_item,
       stationairy_item,
       service_provider,
       meta,
       created_at,
       updated_at)
    VALUES ?
  `,

  CHECK_EXISTING_REIMBURSEMENT_SINGLE_DATE: `
    SELECT * FROM reimbursement
    WHERE employee_id = ?
    AND claim_type = ?
    AND date = ?
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
  `,

  SAVE_ATTACHMENTS: `INSERT INTO reimbursement_attachments (reimbursement_id, line_id, file_name) VALUES ?`,

  CHECK_EXISTING_CLAIM: `
  SELECT * FROM reimbursement
  WHERE employee_id = ?
    AND claim_type = ?
    AND (
      (date IS NOT NULL AND date = ?) OR
      (from_date IS NOT NULL AND to_date IS NOT NULL AND NOT (to_date < ? OR from_date > ?))
    )
  `,

  CHECK_INVOICE_DUPLICATE: `
 SELECT r.id, r.employee_id, r.status
FROM reimbursement_lines rl
JOIN reimbursement r ON rl.reimbursement_id = r.id
WHERE JSON_CONTAINS(rl.meta, JSON_ARRAY(?), '$.invoices')
AND LOWER(TRIM(IFNULL(r.status, ''))) <> 'rejected'
`,

  CHECK_INVOICE_DUPLICATE_EXCLUDE: `
 SELECT r.id, r.employee_id, r.status
FROM reimbursement_lines rl
JOIN reimbursement r ON rl.reimbursement_id = r.id
WHERE JSON_CONTAINS(rl.meta, JSON_ARRAY(?), '$.invoices')
AND r.id <> ?
AND LOWER(TRIM(IFNULL(r.status, ''))) <> 'rejected'
`,

  UPDATE_REIMBURSEMENT: `
    UPDATE reimbursement
    SET department_id=?, claim_type=?, transport_type=?, project=?, participants=?, comments=?, aggregated_total=?
    WHERE id=?
  `,

  GET_APPROVER_DETAILS: `
    SELECT CONCAT(e.first_name, ' ', e.last_name) AS name, ep.role
    FROM employees e
    JOIN employee_professional ep ON e.employee_id = ep.employee_id
    WHERE e.employee_id = ?;
  `,

  UPDATE_REIMBURSEMENT_STATUS: `
    UPDATE reimbursement
    SET status = ?, approver_comments = ?, approver_id = ?, approver_name = ?, approver_designation = ?, project = ?, approved_date = ?
    WHERE id = ?
  `,

  GET_REIMBURSEMENTS_BY_EMPLOYEE: `
    SELECT r.*, CONCAT(e.first_name, ' ', e.last_name) AS employee_name
    FROM reimbursement r
    JOIN employees e ON e.employee_id = r.employee_id
    WHERE r.employee_id = ?
    ORDER BY r.created_at DESC
  `,

  GET_REIMBURSEMENTS_BY_IDS: `
    SELECT * FROM reimbursement WHERE id IN (?)
  `,

  GET_LINES_BY_REIMBURSEMENT_IDS: `
    SELECT * FROM reimbursement_lines WHERE reimbursement_id IN (?) ORDER BY reimbursement_id, line_index ASC
  `,

  DELETE_LINES_BY_REIMBURSEMENT_ID: `DELETE FROM reimbursement_lines WHERE reimbursement_id = ?`,

  DELETE_REIMBURSEMENT: `DELETE FROM reimbursement WHERE id=?`,

  GET_ATTACHMENTS_BY_REIMBURSEMENT_IDS: `
    SELECT id, reimbursement_id, line_id, file_name
    FROM reimbursement_attachments
    WHERE reimbursement_id IN (?)
  `,

  GET_ATTACHMENTS: `
    SELECT id, reimbursement_id, file_name
    FROM reimbursement_attachments
    WHERE reimbursement_id = ?
  `,

  GET_CLAIM_DETAILS: `SELECT r.*, CONCAT(e.first_name, ' ', e.last_name) AS employee_name FROM reimbursement r JOIN employees e ON e.employee_id = r.employee_id WHERE r.id = ?`,

  UPDATE_PAYMENT_STATUS: `
    UPDATE reimbursement
    SET payment_status = ?, paid_date = ?
    WHERE id = ?
  `,

  GET_ALL_PROJECTS: `SELECT project_name FROM add_project;`,

  DELETE_ATTACHMENTS_BY_REIMBURSEMENT_ID: `DELETE FROM reimbursement_attachments WHERE reimbursement_id = ?`,
};
