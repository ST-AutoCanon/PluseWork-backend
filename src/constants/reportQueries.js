module.exports = {
  GET_LEAVE_REPORT: `
  SELECT
    lq.id AS leave_id,
    lq.employee_id,
    CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')) AS employee_name,
    COALESCE(d.name, '') AS department_name,
    lq.leave_type,
    lq.H_F_day,
    lq.compensated_days,
    lq.deducted_days,
    lq.loss_of_pay_days,
    lq.preserved_leave_days,
    DATE_FORMAT(lq.start_date, '%Y-%m-%d') AS start_date,
    DATE_FORMAT(lq.end_date, '%Y-%m-%d') AS end_date,
    lq.reason,
    lq.comments,
    lq.is_defaulted,
    DATE_FORMAT(lq.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
    DATE_FORMAT(lq.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
    lq.status
  FROM leavequeries lq
  JOIN employees e ON lq.employee_id = e.employee_id
  LEFT JOIN employee_professional pr ON e.employee_id = pr.employee_id
  LEFT JOIN departments d ON pr.department_id = d.id
  WHERE ( ? IS NULL OR (COALESCE(lq.updated_at, lq.created_at) >= ? ) )
    AND ( ? IS NULL OR (COALESCE(lq.updated_at, lq.created_at) < DATE_ADD(?, INTERVAL 1 DAY) ) )
    AND ( ? IS NULL OR LOWER(lq.status) = LOWER(?) )
  ORDER BY COALESCE(lq.updated_at, lq.created_at) DESC
`,

  GET_REIMBURSEMENT_REPORT: `
SELECT
  r.id AS reimbursement_id,
  r.id AS id,
  r.employee_id,
  CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')) AS employee_name,
  r.department_id,
  COALESCE(d.name, '') AS department_name,

  r.claim_type,
  r.transport_type,
  MIN(DATE_FORMAT(rl.from_date, '%Y-%m-%d')) AS from_date,
  MAX(DATE_FORMAT(rl.to_date, '%Y-%m-%d')) AS to_date,
  MIN(DATE_FORMAT(rl.date, '%Y-%m-%d')) AS date,
  MAX(rl.travel_from) AS travel_from,
  MAX(rl.travel_to) AS travel_to,
  MAX(rl.purpose) AS purpose,
  MAX(rl.purchasing_item) AS purchasing_item,
  SUM(rl.accommodation_fees) AS accommodation_fees,
  SUM(rl.total_amount) AS line_total_amount,
  MAX(rl.meal_type) AS meal_type,
  MAX(rl.service_provider) AS service_provider,
  SUM(rl.da) AS da,
  SUM(rl.transport_amount) AS transport_amount,
  MAX(rl.stationairy_item) AS stationary,
  r.project,
  MAX(rl.meals_objective) AS meals_objective,

  r.status AS approval_status,
  COALESCE(NULLIF(r.payment_status, ''), NULLIF(r.status, '')) AS payment_status,
  r.payment_status AS raw_payment_status,

  r.approver_id,
  r.approver_name,
  r.approver_designation,
  r.approver_comments,

  DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
  DATE_FORMAT(r.approved_date, '%Y-%m-%d') AS approved_date,
  DATE_FORMAT(r.paid_date, '%Y-%m-%d') AS paid_date,
  DATE_FORMAT(r.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
  r.aggregated_total AS total_amount
FROM reimbursement r
LEFT JOIN reimbursement_lines rl ON r.id = rl.reimbursement_id
LEFT JOIN employees e ON r.employee_id = e.employee_id
LEFT JOIN employee_professional pr ON e.employee_id = pr.employee_id
LEFT JOIN departments d ON pr.department_id = d.id
WHERE ( ? IS NULL OR (COALESCE(r.approved_date, r.created_at) >= ? ) )
  AND ( ? IS NULL OR (COALESCE(r.approved_date, r.created_at) < DATE_ADD(?, INTERVAL 1 DAY) ) )
GROUP BY r.id
ORDER BY r.created_at DESC
`,

  GET_EMPLOYEE_REPORT: `
  SELECT
    e.employee_id,
    e.first_name,
    e.last_name,
    CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')) AS employee_name,
    e.email,
    e.phone_number,
    e.status,
    p.address,
    p.father_name,
    p.mother_name,
    p.gender,
    p.marital_status,
    p.spouse_name,
    DATE_FORMAT(p.marriage_date, '%Y-%m-%d') AS marriage_date,
    p.aadhaar_number,
    p.aadhaar_doc_url,
    p.pan_number,
    p.pan_doc_url,
    p.passport_number,
    p.passport_doc_url,
    p.voter_id,
    p.voter_id_doc_url,
    p.insurance_doc,
    p.alternate_email,
    p.alternate_number,
    p.blood_group,
    p.emergency_name,
    p.emergency_number,
    DATE_FORMAT(p.father_dob, '%Y-%m-%d') AS father_dob,
    p.father_gov_doc_url,
    DATE_FORMAT(p.mother_dob, '%Y-%m-%d') AS mother_dob,
    p.mother_gov_doc_url,
    DATE_FORMAT(p.spouse_dob, '%Y-%m-%d') AS spouse_dob,
    p.spouse_gov_doc_url,
    p.child1_name,
    DATE_FORMAT(p.child1_dob, '%Y-%m-%d') AS child1_dob,
    p.child1_gov_doc_url,
    p.child2_name,
    DATE_FORMAT(p.child2_dob, '%Y-%m-%d') AS child2_dob,
    p.child2_gov_doc_url,
    p.child3_name,
    DATE_FORMAT(p.child3_dob, '%Y-%m-%d') AS child3_dob,
    p.child3_gov_doc_url,
    p.driving_license_number,
    p.driving_license_doc_url,
    p.uan_number,
    p.pf_number,
    p.esi_number,
    pr.domain,
    pr.employee_type,
    DATE_FORMAT(pr.joining_date, '%Y-%m-%d') AS joining_date,
    pr.role,
    pr.position,
    pr.department_id,
    COALESCE(d.name, '') AS department_name,
    pr.supervisor_id,
    CONCAT(sup.first_name, ' ', sup.last_name) AS supervisor_name,
    pr.salary,
    pr.resume_url,
    MAX(bd.bank_name) AS bank_name,
    MAX(bd.account_number) AS account_number,
    MAX(bd.ifsc_code) AS ifsc_code,
    MAX(bd.branch_name) AS bank_branch,
    DATE_FORMAT(e.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
  FROM employees e
  LEFT JOIN employee_personal p ON e.employee_id = p.employee_id
  LEFT JOIN employee_professional pr ON e.employee_id = pr.employee_id
  LEFT JOIN departments d ON pr.department_id = d.id
  LEFT JOIN employee_bank_details bd ON e.employee_id = bd.employee_id
  LEFT JOIN employees sup ON pr.supervisor_id = sup.employee_id
  WHERE
    ( ? IS NULL OR (e.created_at >= ? ) )
    AND ( ? IS NULL OR (e.created_at < DATE_ADD(?, INTERVAL 1 DAY) ) )
    AND ( ? IS NULL OR LOWER(e.status) = LOWER(?) )
    AND ( ? IS NULL OR pr.department_id = ? )
  GROUP BY e.employee_id
  ORDER BY e.created_at DESC
`,

  GET_EMPLOYEE_REPORT_COMPACT: `
SELECT
  e.employee_id,
  e.first_name,
  e.middle_name,
  e.last_name,
  CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')) AS employee_name,
  e.email,
  DATE_FORMAT(e.dob, '%Y-%m-%d') AS dob,
  e.phone_number,
  e.status,
  pr.employee_type,
  pr.role,
  pr.position,
  DATE_FORMAT(pr.joining_date, '%Y-%m-%d') AS joining_date,
  pr.department_id,
  COALESCE(d.name, '') AS department_name,
  pr.supervisor_id,
  CONCAT(COALESCE(sup.first_name, ''), ' ', COALESCE(sup.last_name, '')) AS supervisor_name,
  p.address,
  p.aadhaar_number,
  p.father_name,
  p.mother_name,
  MAX(bd.bank_name) AS bank_name,
  MAX(bd.account_number) AS account_number,
  MAX(bd.ifsc_code) AS ifsc_code,
  MAX(bd.branch_name) AS bank_branch,
  DATE_FORMAT(e.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
FROM employees e
LEFT JOIN employee_professional pr ON e.employee_id = pr.employee_id
LEFT JOIN departments d ON pr.department_id = d.id
LEFT JOIN employees sup ON pr.supervisor_id = sup.employee_id
LEFT JOIN employee_personal p ON e.employee_id = p.employee_id
LEFT JOIN employee_bank_details bd ON e.employee_id = bd.employee_id
WHERE ( ? IS NULL OR (e.created_at >= ? ) )
  AND ( ? IS NULL OR (e.created_at < DATE_ADD(?, INTERVAL 1 DAY) ) )
  AND ( ? IS NULL OR LOWER(e.status) = LOWER(?) )
  AND ( ? IS NULL OR pr.department_id = ? )
GROUP BY e.employee_id
ORDER BY e.created_at DESC
`,

  GET_VENDOR_REPORT: `
  SELECT
    v.vendor_id,
    v.company_name,
    v.registered_address,
    v.city,
    v.state,
    v.pin_code,
    v.gst_number,
    v.pan_number,
    v.company_type,
    v.contact1_name,
    v.contact1_designation,
    v.contact1_mobile,
    v.contact1_email,
    v.bank_name,
    v.branch,
    v.branch_address,
    v.account_number,
    v.ifsc_code,
    v.nature_of_business,
    v.product_category,
    v.years_of_experience,
    v.cancelled_cheque,
    v.msme_status,
    v.created_at
  FROM vendors v
  WHERE ( ? IS NULL OR (COALESCE(v.created_at, NOW()) >= ? ) )
    AND ( ? IS NULL OR (COALESCE(v.created_at, NOW()) < DATE_ADD(?, INTERVAL 1 DAY) ) )
    AND ( ? IS NULL OR 1=1 )
    AND ( ? IS NULL OR 1=1 )
  ORDER BY COALESCE(v.created_at, NOW()) DESC
`,

  GET_ASSET_REPORT: `
  SELECT
    a.asset_id,
    a.asset_name,
    a.configuration,
    a.valuation_date,
    a.assigned_to,
    a.document_path,
    a.created_at,
    a.category,
    a.sub_category,
    a.status,
    a.count,
    a.asset_code
  FROM assets a
  WHERE ( ? IS NULL OR (COALESCE(a.created_at, a.valuation_date, NOW()) >= ? ) )
    AND ( ? IS NULL OR (COALESCE(a.created_at, a.valuation_date, NOW()) < DATE_ADD(?, INTERVAL 1 DAY) ) )
  ORDER BY COALESCE(a.created_at, a.valuation_date, NOW()) DESC
`,

  GET_EMPLOYEE_ATTENDANCE_REPORT: `
    SELECT
      punch_id,
      employee_id,
      punch_status,
      DATE_FORMAT(punchin_time, '%Y-%m-%d %H:%i:%s') AS punchin_time,
      punchin_device,
      punchin_location,
      DATE_FORMAT(punchout_time, '%Y-%m-%d %H:%i:%s') AS punchout_time,
      punchout_device,
      punchout_location,
      punchmode,
      DATE_FORMAT(punchin_time, '%Y-%m-%d %H:%i:%s') AS created_at
    FROM emp_attendence
    WHERE ( ? IS NULL OR (punchin_time >= ? ) )
      AND ( ? IS NULL OR (punchin_time < DATE_ADD(?, INTERVAL 1 DAY) ) )
    ORDER BY punchin_time DESC
  `,

  GET_SUPERVISOR_TASK_REPORT: `
  SELECT
    t.task_id,
    t.employee_id,
    CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')) AS employee_name,
    t.task_title,
    t.description,
    DATE_FORMAT(t.start_date, '%Y-%m-%d') AS start_date,
    DATE_FORMAT(t.due_date, '%Y-%m-%d') AS due_date,
    t.status,
    t.percentage,
    t.progress_percentage,
    DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
    DATE_FORMAT(t.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
  FROM tasks t
  LEFT JOIN employees e ON t.employee_id = e.employee_id
  WHERE ( ? IS NULL OR (t.start_date >= ? ) )
    AND ( ? IS NULL OR (t.due_date < DATE_ADD(?, INTERVAL 1 DAY) ) )
    AND ( ? IS NULL OR LOWER(t.status) = LOWER(?) )
  ORDER BY t.start_date DESC, t.task_id ASC
  `,

  GET_EMPLOYEE_TASK_REPORT: `
  SELECT
    wt.task_id,
    wt.week_id,
    DATE_FORMAT(wt.task_date, '%Y-%m-%d') AS task_date,
    wt.project_id,
    wt.project_name,
    wt.task_name,
    wt.replacement_task,
    wt.employee_id,
    CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')) AS employee_name,
    wt.emp_status,
    wt.emp_comment,
    wt.sup_status,
    wt.sup_comment,
    wt.sup_review_status,
    wt.star_rating,
    wt.parent_task_id,
    DATE_FORMAT(wt.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
    DATE_FORMAT(wt.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
  FROM weekly_tasks wt
  LEFT JOIN employees e ON wt.employee_id COLLATE utf8mb4_general_ci = e.employee_id COLLATE utf8mb4_general_ci
  WHERE ( ? IS NULL OR (wt.task_date >= ? ) )
    AND ( ? IS NULL OR (wt.task_date < DATE_ADD(?, INTERVAL 1 DAY) ) )
  ORDER BY wt.task_date DESC, wt.task_id ASC
`,

  GET_DEPARTMENTS: `
    SELECT id AS department_id, name AS department_name
    FROM departments
    ORDER BY name ASC
    LIMIT 1000
  `,

  GET_DEPARTMENT_NAME_BY_ID: `
    SELECT name FROM departments WHERE id = ? LIMIT 1
  `,

  SEARCH_EMPLOYEES: `
    SELECT
      e.employee_id,
      CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')) AS employee_name,
      e.email,
      pr.department_id,
      COALESCE(d.name, '') AS department_name
    FROM employees e
    LEFT JOIN employee_professional pr ON e.employee_id = pr.employee_id
    LEFT JOIN departments d ON pr.department_id = d.id
    WHERE (LOWER(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))) LIKE LOWER(?) OR LOWER(e.email) LIKE LOWER(?) OR LOWER(e.employee_id) LIKE LOWER(?))
      AND ( ? IS NULL OR pr.department_id = ? )
    ORDER BY employee_name ASC
    LIMIT ?
  `,

  GET_WEEKLY_TASK_REPORT: `
  SELECT
    wt.task_id,
    wt.week_id,
    DATE_FORMAT(wt.task_date, '%Y-%m-%d') AS task_date,
    wt.project_id,
    wt.project_name,
    wt.task_name,
    wt.replacement_task,
    wt.employee_id,
    CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')) AS employee_name,
    wt.emp_status,
    wt.emp_comment,
    wt.sup_status,
    wt.sup_comment,
    wt.sup_review_status,
    wt.star_rating,
    wt.parent_task_id,
    DATE_FORMAT(wt.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
    DATE_FORMAT(wt.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
  FROM weekly_tasks wt
  LEFT JOIN employees e ON wt.employee_id = e.employee_id
  WHERE ( ? IS NULL OR (wt.task_date >= ? ) )
    AND ( ? IS NULL OR (wt.task_date < DATE_ADD(?, INTERVAL 1 DAY) ) )
  ORDER BY wt.task_date DESC, wt.task_id ASC
`,
};

const q = module.exports;
q.GET_TASK_REPORT = q.GET_SUPERVISOR_TASK_REPORT;
q.GET_WEEKLY_TASK_REPORT = q.GET_EMPLOYEE_TASK_REPORT;
module.exports = q;
