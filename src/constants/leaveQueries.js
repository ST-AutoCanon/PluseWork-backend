module.exports = {
  getAll: `
    SELECT
      id,
      period,
      DATE_FORMAT(year_start, '%Y-%m-%d') AS year_start,
      DATE_FORMAT(year_end,   '%Y-%m-%d') AS year_end,
      leave_settings
    FROM leave_policy
    WHERE org_id =?
    ORDER BY year_start DESC, period
  `,

  getById: `
    SELECT
      id,
      period,
      DATE_FORMAT(year_start, '%Y-%m-%d') AS year_start,
      DATE_FORMAT(year_end,   '%Y-%m-%d') AS year_end,
      leave_settings
    FROM leave_policy
    WHERE id = ?
  `,

  create: `
    INSERT INTO leave_policy
      (org_id, period, year_start, year_end, leave_settings)
    VALUES (?, ?, ?, ?, ?)
  `,

  update: `
    UPDATE leave_policy
    SET
      period         = ?,
      year_start     = ?,
      year_end       = ?,
      leave_settings = ?
    WHERE id = ? AND org_id = ?
  `,

  remove: `
    DELETE FROM leave_policy
    WHERE id = ? AND org_id = ?
  `,

  GET_LEAVE_TYPES: `
    SELECT
      id,
      org_id,
      type_key,
      display_name,
      gender,
      min_age,
      max_age,
      is_active
    FROM leave_types
    WHERE org_id = ?
    ORDER BY display_name
  `,

  GET_LEAVE_TYPE_BY_KEY: `
    SELECT
      id,
      org_id,
      \`type_key\` AS \`key\`,
      display_name AS label,
      gender,
      min_age,
      max_age,
      is_active
    FROM leave_types
    WHERE org_id = ? AND ( \`type_key\` = ? OR id = ? ) LIMIT 1
  `,

  /* employee personal (gender) and employees (dob) fetch to validate eligibility */
  GET_EMPLOYEE_PERSONAL: `
    SELECT
      e.employee_id,
      e.dob AS employee_dob,
      ep.gender AS personal_gender,
      ep.spouse_dob,
      ep.child1_dob,
      ep.child2_dob,
      ep.child3_dob
    FROM employees e
    LEFT JOIN employee_personal ep
      ON e.employee_id = ep.employee_id
    WHERE e.employee_id = ? LIMIT 1
  `,

  /* ---- existing leave queries ---- */
  GET_LEAVE_BY_ID: `
    SELECT
      lq.*,
      CONCAT(e.first_name, ' ', e.last_name) AS name
    FROM leavequeries lq
    JOIN employees e
      ON lq.employee_id = e.employee_id
    WHERE lq.id = ? AND lq.employee_id = ?;
  `,

  INSERT_LEAVE_REQUEST: `
    INSERT INTO leavequeries (
      employee_id, start_date, end_date,
      H_F_day, reason, leave_type, org_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?);
  `,

  GET_WORKED_DAYS: `
    SELECT COUNT(DISTINCT DATE(punchin_time)) AS worked_days
    FROM emp_attendence
    WHERE employee_id = ?
      AND DATE(punchin_time) BETWEEN ? AND ?
      AND punchin_time IS NOT NULL
      AND punchout_time IS NOT NULL
  `,

  GET_USED_LEAVES_IN_PERIOD: `
SELECT
  leave_type,
  SUM(
    CASE
      WHEN (COALESCE(deducted_days, 0) > 0 OR COALESCE(loss_of_pay_days, 0) > 0)
        THEN COALESCE(deducted_days, 0)
      WHEN H_F_day LIKE '%Half%' AND start_date = end_date
        THEN 0.5
      ELSE DATEDIFF(end_date, start_date) + 1
    END
  ) AS used
FROM leavequeries
WHERE employee_id = ?
  AND status = 'Approved'
  AND (
     (start_date BETWEEN ? AND ?)
     OR (end_date BETWEEN ? AND ?)
     OR (start_date <= ? AND end_date >= ?)
  )
GROUP BY leave_type;

`,

  UPSERT_EMPLOYEE_MONTHLY_LOP: `
    INSERT INTO employee_monthly_lop (employee_id, month, year, lop)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      lop = VALUES(lop),
      computed_at = CURRENT_TIMESTAMP;
  `,

  GET_EMPLOYEE_MONTHLY_LOP: `
    SELECT lop, DATE_FORMAT(computed_at, '%Y-%m-%d %H:%i:%s') AS computed_at
    FROM employee_monthly_lop
    WHERE employee_id = ? AND month = ? AND year = ?;
  `,

  GET_EMPLOYEE_CARRY_FORWARD: `
    SELECT leave_type, amount
    FROM employee_leave_carry_forward
    WHERE employee_id = ? AND year = ?
  `,

  INSERT_LEAVE_AUDIT: `
    INSERT INTO leave_audit (
      leave_id,
      actor_id,
      action,
      details,
      created_at
    ) VALUES (?, ?, ?, ?, NOW())
  `,

  /* --- leave request / admin queries --- */
  GET_LEAVE_BY_ID_LEGACY: `
    SELECT
      lq.*,
      CONCAT(e.first_name, ' ', e.last_name) AS name
    FROM leavequeries lq
    JOIN employees e
      ON lq.employee_id = e.employee_id
    WHERE lq.id = ? AND lq.employee_id = ?
  `,

  UPDATE_LEAVE_REQUEST: `
    UPDATE leavequeries
    SET start_date = ?,
        end_date   = ?,
        H_F_day    = ?,
        reason     = ?,
        leave_type = ?
    WHERE id = ? AND employee_id = ?
  `,

  DELETE_LEAVE_REQUEST: `
    DELETE FROM leavequeries
    WHERE id = ? AND employee_id = ?
  `,

  SELECT_LEAVE_REQUESTS: `
    SELECT
      lq.*,
      CONCAT(e.first_name, ' ', e.last_name) AS name
    FROM leavequeries lq
    JOIN employees e
      ON lq.employee_id = e.employee_id
    WHERE lq.employee_id = ?
  `,

  GET_LEAVE_QUERIES: `
  SELECT
    lq.id AS leave_id,
    lq.employee_id,
    lq.leave_type,
    lq.H_F_day,
    lq.reason,
    lq.status,
    lq.start_date,
    lq.end_date,
    lq.comments,
    lq.is_defaulted,
    lq.created_at,
    CONCAT(e.first_name, ' ', e.last_name) AS name,
    d.name AS department_name
  FROM leavequeries lq
  JOIN employees e
    ON lq.employee_id = e.employee_id
  LEFT JOIN employee_professional pr
    ON e.employee_id = pr.employee_id
  LEFT JOIN departments d
    ON pr.department_id = d.id
  WHERE 1=1
`,

  SEARCH_LEAVE_QUERIES: `
  SELECT
    lq.id AS leave_id,
    lq.employee_id,
    lq.reason,
    lq.status,
    lq.start_date,
    lq.end_date,
    lq.created_at,
    lq.is_defaulted,
    CONCAT(e.first_name, ' ', e.last_name) AS name,
    d.name AS department_name
  FROM leavequeries lq
  JOIN employees e
    ON lq.employee_id = e.employee_id
  LEFT JOIN employee_professional pr
    ON e.employee_id = pr.employee_id
  LEFT JOIN departments d
    ON pr.department_id = d.id
  WHERE (
    (lq.status = ? AND lq.leave_type = ?)
    OR (
      lq.employee_id LIKE ? OR
      lq.reason LIKE ? OR
      CONCAT(e.first_name, ' ', e.last_name) LIKE ?
    )
  )
`,

  UPDATE_LEAVE_STATUS: `
    UPDATE leavequeries
    SET status   = ?,
        comments = ?
    WHERE id = ?
  `,

  GET_EMPLOYEE_BY_ID: `
    SELECT * FROM employees WHERE employee_id = ?
  `,

  GET_EMPLOYEES_BY_DEPARTMENT: `
    SELECT e.employee_id
    FROM employees e
    JOIN employee_professional pr
      ON e.employee_id = pr.employee_id
    WHERE pr.department_id = ?
  `,

  GET_LEAVE_QUERIES_FOR_TEAM: `
    SELECT
      lq.id AS leave_id,
      lq.employee_id,
      lq.leave_type,
      lq.H_F_day,
      lq.reason,
      lq.status,
      lq.start_date,
      lq.end_date,
      lq.comments,
      lq.is_defaulted,
      lq.created_at,
      CONCAT(e.first_name, ' ', e.last_name) AS name,
      d.name AS department_name
    FROM leavequeries lq
    JOIN employees e
      ON lq.employee_id = e.employee_id
    LEFT JOIN employee_professional pr
      ON e.employee_id = pr.employee_id
    LEFT JOIN departments d
      ON pr.department_id = d.id
    WHERE 1=1
  `,

  GET_LEAVE_BY_LEAVEID: `
    SELECT *
    FROM leavequeries
    WHERE id = ?
  `,

  UPDATE_LEAVE_STATUS_EXTENDED: `
    UPDATE leavequeries
    SET status = ?,
        comments = ?,
        compensated_days = ?,
        deducted_days = ?,
        loss_of_pay_days = ?,
        preserved_leave_days = ?,
        is_defaulted = ?,
        updated_at = NOW()
    WHERE id = ?
  `,

  ADJUST_LEAVE_BALANCE: `
    UPDATE employee_leave_balances
    SET remaining = GREATEST(0, remaining - ?)
    WHERE employee_id = ? AND leave_type = ?
  `,

  INSERT_LOP_RECORD: `
    INSERT INTO lop_records (
      employee_id,
      leave_id,
      lop_days,
      reason,
      created_at
    ) VALUES (?, ?, ?, ?, NOW())
  `,

  GET_EMP_PROF_BY_ID: `
    SELECT *
    FROM employee_professional
    WHERE employee_id = ?
    LIMIT 1
  `,
  getLeaveTypesByOrg: `
    SELECT
      id,
      org_id,
      COALESCE(type_key, '') AS type_key,
      COALESCE(display_name, type_key) AS display_name,
      COALESCE(gender, 'All') AS gender,
      min_age,
      max_age,
      is_active
    FROM leave_types
    WHERE org_id = ?
    ORDER BY display_name ASC
  `,
  GET_EMPLOYEES_BY_SUPERVISOR: `
    SELECT e.employee_id
    FROM employees e
    JOIN employee_professional pr
      ON e.employee_id = pr.employee_id
    WHERE pr.supervisor_id = ?
  `,
};

