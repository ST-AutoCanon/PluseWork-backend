module.exports = {
  // 1) Fetch all policies
  getAll: `
    SELECT
      id,
      period,
      DATE_FORMAT(year_start, '%Y-%m-%d') AS year_start,
      DATE_FORMAT(year_end,   '%Y-%m-%d') AS year_end,
      leave_settings
    FROM leave_policy
    ORDER BY year_start DESC, period
  `,

  // 2) Fetch a single policy by ID
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

  // 3) Insert a new policy (JSON string)
  create: `
    INSERT INTO leave_policy
      (period, year_start, year_end, leave_settings)
    VALUES (?, ?, ?, ?)
  `,

  // 4) Update an existing policy
  update: `
    UPDATE leave_policy
    SET
      period         = ?,
      year_start     = ?,
      year_end       = ?,
      leave_settings = ?
    WHERE id = ?
  `,

  // 5) Delete a policy
  remove: `
    DELETE FROM leave_policy
    WHERE id = ?
  `,

  // LeaveQueries / leave request queries (kept for compatibility)
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
      H_F_day, reason, leave_type
    ) VALUES (?, ?, ?, ?, ?, ?);
  `,

  // ------------------------------------------------------------------
  // New queries for attendance + monthly LOP persistence
  // ------------------------------------------------------------------

  // Count worked days where both punchin_time and punchout_time exist between a date range
  // Params: [employeeId, startDate, endDate]
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

  // Upsert into employee_monthly_lop
  // Params: [employeeId, month, year, lop]
  UPSERT_EMPLOYEE_MONTHLY_LOP: `
    INSERT INTO employee_monthly_lop (employee_id, month, year, lop)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      lop = VALUES(lop),
      computed_at = CURRENT_TIMESTAMP;
  `,

  // Fetch stored monthly lop if present
  // Params: [employeeId, month, year]
  GET_EMPLOYEE_MONTHLY_LOP: `
    SELECT lop, DATE_FORMAT(computed_at, '%Y-%m-%d %H:%i:%s') AS computed_at
    FROM employee_monthly_lop
    WHERE employee_id = ? AND month = ? AND year = ?;
  `,

  // new query: get per-employee carry forward for a policy year
  GET_EMPLOYEE_CARRY_FORWARD: `
    SELECT leave_type, amount
    FROM employee_leave_carry_forward
    WHERE employee_id = ? AND year = ?
  `,
  // Insert audit record for traceability
  INSERT_LEAVE_AUDIT: `
    INSERT INTO leave_audit (
      leave_id,
      actor_id,
      action,
      details,
      created_at
    ) VALUES (?, ?, ?, ?, NOW())
  `,
};
