


const EXIT_QUERIES = {

  // ────────────── Employee ──────────────
  INSERT_NEW_REQUEST: `
    INSERT INTO employee_exit_requests1
    (org_id, employee_id, reason, other_reason, employee_comment, proposed_lwd)
    VALUES (?, ?, ?, ?, ?, ?)
  `,

  EXISTS_ACTIVE_REQUEST: `
    SELECT 1 FROM employee_exit_requests1
    WHERE org_id = ? AND employee_id = ? AND is_active = 1
    LIMIT 1
  `,

  GET_MY_ACTIVE_REQUEST: `
    SELECT * FROM employee_exit_requests1
    WHERE org_id = ? AND employee_id = ? AND is_active = 1
    ORDER BY applied_at DESC LIMIT 1
  `,

  REQUEST_WITHDRAWAL: `
    UPDATE employee_exit_requests1
    SET
      withdrawal_requested_at = NOW(),
      withdrawal_reason = ?,
      withdrawal_supervisor_status = 'PENDING',
      withdrawal_hr_status = NULL
    WHERE id = ? AND org_id = ? AND employee_id = ? AND is_active = 1
  `,

  // ────────────── Supervisor ──────────────
  GET_SUPERVISOR_PENDING: `
    SELECT * FROM employee_exit_requests1
    WHERE org_id = ?
      AND is_active = 1
      AND supervisor_status = 'PENDING'
    ORDER BY applied_at DESC
  `,

  GET_SUPERVISOR_WITHDRAW_PENDING: `
    SELECT * FROM employee_exit_requests1
    WHERE org_id = ?
      AND is_active = 1
      AND withdrawal_requested_at IS NOT NULL
      AND withdrawal_supervisor_status = 'PENDING'
    ORDER BY withdrawal_requested_at DESC
  `,

  SUPERVISOR_UPDATE_NORMAL: `
    UPDATE employee_exit_requests1
    SET
      supervisor_status = ?,
      supervisor_recommended_lwd = ?,
      supervisor_comment = ?,
      supervisor_action_at = NOW(),
      supervisor_action_by = ?,
      hr_status = CASE 
        WHEN ? = 'APPROVED' THEN 'PENDING'
        ELSE hr_status
      END
    WHERE id = ? AND org_id = ?
  `,

  SUPERVISOR_REJECT_FULL: `
    UPDATE employee_exit_requests1
    SET
      supervisor_status = 'REJECTED',
      supervisor_comment = ?,
      supervisor_action_at = NOW(),
      supervisor_action_by = ?,
      is_active = 0,
      final_outcome = 'REJECTED'
    WHERE id = ? AND org_id = ?
  `,

  SUPERVISOR_UPDATE_WITHDRAWAL: `
    UPDATE employee_exit_requests1
    SET
      withdrawal_supervisor_status = ?,
      supervisor_comment = ?,
      supervisor_action_at = NOW()
    WHERE id = ? AND org_id = ?
  `,

  // ────────────── HR ──────────────
  // constants/exitQueries.js

// Replace both GET_HR_WITHDRAW_PENDING and keep GET_HR_PENDING as is
GET_HR_PENDING: `
  SELECT * FROM employee_exit_requests1
  WHERE org_id = ?
    AND is_active = 1
    AND hr_status = 'PENDING'
  ORDER BY applied_at DESC
`,
GET_HR_WITHDRAW_PENDING: `
  SELECT * FROM employee_exit_requests1
  WHERE org_id = ?
    AND is_active = 1
    AND withdrawal_requested_at IS NOT NULL
    AND (withdrawal_hr_status = 'PENDING' OR withdrawal_hr_status IS NULL)
  ORDER BY withdrawal_requested_at DESC
`,

  HR_UPDATE_NORMAL: `
    UPDATE employee_exit_requests1
    SET
      hr_status = ?,
      hr_final_lwd = ?,
      hr_comment = ?,
      hr_action_at = NOW(),
      hr_action_by = ?
    WHERE id = ? AND org_id = ?
  `,

  HR_FINAL_APPROVE_RESIGN: `
    UPDATE employee_exit_requests1
    SET
      hr_status = 'APPROVED',
      hr_final_lwd = ?,
      hr_comment = ?,
      leave_policy = ?,
      hr_action_at = NOW(),
      hr_action_by = ?,
      is_active = 0,
      final_outcome = 'RESIGNED',
      final_lwd = ?
    WHERE id = ? AND org_id = ?
  `,
GET_MY_ACTIVE_REQUEST: `
  SELECT *
FROM employee_exit_requests1
WHERE org_id = ? AND employee_id = ?
ORDER BY applied_at DESC
LIMIT 1;
`,
  HR_FINAL_APPROVE_WITHDRAW: `
    UPDATE employee_exit_requests1
    SET
      withdrawal_hr_status = 'APPROVED',
      hr_comment = ?,
      hr_action_at = NOW(),
      hr_action_by = ?,
      is_active = 0,
      final_outcome = 'WITHDRAWN'
    WHERE id = ? AND org_id = ?
  `,
  HR_SET_PLANNED_DATES: `
  UPDATE employee_exit_requests1
  SET
    kt_planned_date         = ?,
    assets_return_planned_date = ?
  WHERE id = ? 
    AND org_id = ? 
    AND final_outcome = 'RESIGNED'
    AND kt_planned_date IS NULL   -- prevent overwriting once set
`,

HR_CONFIRM_POST_DUE_CLEARANCE: `
  UPDATE employee_exit_requests1
  SET
    kt_completed           = ?,
    assets_returned        = ?,
    clearance_completed_at = CASE 
      WHEN ? = 1 AND ? = 1 THEN NOW() 
      ELSE clearance_completed_at 
    END
  WHERE id = ? 
    AND org_id = ? 
    AND final_outcome = 'RESIGNED'
    -- Optional safety: only allow confirmation after planned dates
    AND (
      (kt_planned_date IS NULL OR kt_planned_date <= CURDATE())
      AND 
      (assets_return_planned_date IS NULL OR assets_return_planned_date <= CURDATE())
    )
`,EMPLOYEE_PROPOSE_CLEARANCE_DATES: `
    UPDATE employee_exit_requests1
    SET
      kt_proposed_date = ?,
      assets_proposed_date = ?,
      proposed_dates_submitted_at = NOW()
    WHERE id = ? 
      AND org_id = ? 
      AND employee_id = ?
      AND final_outcome = 'RESIGNED'
      AND proposed_dates_submitted_at IS NULL   -- allow only once (remove if edits allowed)
  `,

  HR_UPDATE_CLEARANCE_STATUS: `
    UPDATE employee_exit_requests1
    SET
      kt_completed = ?,
      assets_returned = ?,
      clearance_completed_at = CASE 
        WHEN ? = 1 AND ? = 1 THEN NOW() 
        ELSE clearance_completed_at 
      END
    WHERE id = ? 
      AND org_id = ? 
      AND final_outcome = 'RESIGNED'
  `  ,// ────────────── Clearance Flow ──────────────
  EMPLOYEE_PROPOSE_CLEARANCE_DATES: `
    UPDATE employee_exit_requests1
    SET
      kt_proposed_date = ?,
      assets_proposed_date = ?,
      proposed_dates_submitted_at = NOW()
    WHERE id = ?
      AND org_id = ?
      AND employee_id = ?
      AND final_outcome = 'RESIGNED'
      AND proposed_dates_submitted_at IS NULL
  `,

  HR_SET_FINAL_PLANNED_DATES: `
  UPDATE employee_exit_requests1
  SET
    kt_planned_date = ?,
    assets_return_planned_date = ?
  WHERE id = ? AND org_id = ?
`,
  GET_HR_RESIGNED_CLEARANCE: `
    SELECT 
      id,
      employee_id,
      reason,
      proposed_lwd,
      final_lwd,
      hr_action_at,
      kt_proposed_date,
      assets_proposed_date,
      proposed_dates_submitted_at,
      kt_planned_date,
      assets_return_planned_date,
      kt_completed,
      assets_returned,
      clearance_completed_at
    FROM employee_exit_requests1
    WHERE org_id = ?
      AND final_outcome = 'RESIGNED'
    ORDER BY hr_action_at DESC
  `,

  HR_UPDATE_CLEARANCE_STATUS: `
    UPDATE employee_exit_requests1
    SET
      kt_completed = ?,
      assets_returned = ?,
      clearance_completed_at = CASE 
        WHEN ? = 1 AND ? = 1 THEN NOW() 
        ELSE clearance_completed_at 
      END
    WHERE id = ? 
      AND org_id = ? 
      AND final_outcome = 'RESIGNED'
  `
  ,
  // ... your existing queries ...

// ── NEW: All team exit requests (for managers/supervisors) ──
GET_MY_TEAM_ALL_REQUESTS: `
  WITH RECURSIVE employee_tree AS (
    SELECT 
      employee_id,
      supervisor_id,
      1 AS level
    FROM employee_professional
    WHERE supervisor_id = ?
      COLLATE utf8mb4_0900_ai_ci

    UNION ALL

    SELECT 
      ep.employee_id,
      ep.supervisor_id,
      et.level + 1
    FROM employee_professional ep
    INNER JOIN employee_tree et 
      ON ep.supervisor_id = et.employee_id COLLATE utf8mb4_0900_ai_ci
  )
  SELECT 
    eer.*,
    CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
    et.level
  FROM employee_exit_requests1 eer
  INNER JOIN employee_tree et 
    ON eer.employee_id = et.employee_id COLLATE utf8mb4_0900_ai_ci
  JOIN employees e 
    ON e.employee_id = et.employee_id COLLATE utf8mb4_0900_ai_ci
  WHERE eer.org_id = ?
  ORDER BY 
    COALESCE(eer.hr_action_at, eer.supervisor_action_at, eer.applied_at) DESC
`,

// ── NEW: All organization exit requests (for HR) ──
GET_ALL_ORG_EXIT_REQUESTS: `
  SELECT 
    eer.*,
    CONCAT(e.first_name, ' ', e.last_name) AS employee_name
  FROM employee_exit_requests1 eer
  JOIN employees e 
    ON eer.employee_id = e.employee_id COLLATE utf8mb4_0900_ai_ci
    AND eer.org_id      = e.org_id      COLLATE utf8mb4_0900_ai_ci
  WHERE eer.org_id = ?
  ORDER BY 
    COALESCE(eer.hr_action_at, eer.supervisor_action_at, eer.applied_at) DESC
`,



};


module.exports = EXIT_QUERIES;