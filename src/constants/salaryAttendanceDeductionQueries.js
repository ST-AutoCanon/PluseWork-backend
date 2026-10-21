// module.exports = {
//   GET_POLICIES: `
//     SELECT
//       p.id,
//       p.org_id,
//       p.policy_type,
//       p.applies_to,
//       p.deduction_basis,
//       p.deduction_type,
//       p.deduction_value,
//       p.min_duration,
//       p.limit_weekly,
//       p.limit_monthly,
//       p.half_day_below_hours,
//       p.full_day_below_hours,
//       p.enable_full_day_threshold,
//       p.late_count_limit,
//       p.late_within_days,
//       p.punch_in_time,
//       p.buffer_time,
//       p.punch_out_time,
//       p.shifts,
//       p.skip_if_regularised,
//       p.effective_from,
//       p.effective_till,
//       a.assignment_type,
//       a.reference_id,
//       a.reference_name
//     FROM punch_policies p
//     LEFT JOIN punch_policy_assignments a
//       ON a.policy_id = p.id
//      AND a.org_id = p.org_id
//     WHERE p.org_id = ?
//       AND p.policy_status = 'active'
//       AND p.deleted_at IS NULL
//       AND p.effective_from <= ?
//       AND (p.effective_till IS NULL OR p.effective_till >= ?)
//     ORDER BY p.id DESC
//   `,

//   GET_ATTENDANCE: `
//     SELECT
//       ea.employee_id,
//       ea.punch_status,
//       ea.punchin_time,
//       ea.punchout_time,
//       ea.punchout_device,
//       ea.punchout_location,
//       ea.punchmode,
//       ea.late_login,
//       DATE(COALESCE(ea.punchin_time, ea.punchout_time)) AS attendance_date,
//       ep.department_id,
//       d.name AS department_name
//     FROM emp_attendence ea
//     INNER JOIN employees e
//       ON e.employee_id = ea.employee_id
//     LEFT JOIN employee_professional ep
//       ON ep.employee_id = e.employee_id
//     LEFT JOIN departments d
//       ON d.id = ep.department_id
//     WHERE e.org_id = ?
//       AND DATE(COALESCE(ea.punchin_time, ea.punchout_time)) BETWEEN ? AND ?
//     ORDER BY ea.employee_id, attendance_date, ea.punchin_time
//   `,

//   GET_APPROVED_REGULARISATIONS: `
//     SELECT
//       employee_id,
//       regularisation_type,
//       selected_dates,
//       primary_date
//     FROM leave_regularisation_requests
//     WHERE org_id = ?
//       AND status = 'Approved'
//   `,
// };

module.exports = {
  GET_POLICIES: `
    SELECT
      p.id,
      p.org_id,
      p.policy_type,
      p.applies_to,
      p.deduction_basis,
      p.deduction_type,
      p.deduction_value,
      p.half_day_deduction_basis,
      p.half_day_deduction_value,
      p.full_day_deduction_basis,
      p.full_day_deduction_value,
      p.min_duration,
      p.limit_weekly,
      p.limit_monthly,
      p.half_day_below_hours,
      p.full_day_below_hours,
      p.enable_full_day_threshold,
      p.late_count_limit,
      p.late_within_days,
      p.punch_in_time,
      p.buffer_time,
      p.punch_out_time,
      p.shifts,
      p.skip_if_regularised,
      p.effective_from,
      p.effective_till,
      a.assignment_type,
      a.reference_id,
      a.reference_name
    FROM punch_policies p
    LEFT JOIN punch_policy_assignments a
      ON a.policy_id = p.id
     AND a.org_id = p.org_id
    WHERE p.org_id = ?
      AND p.policy_status = 'active'
      AND p.deleted_at IS NULL
      AND p.effective_from <= ?
      AND (p.effective_till IS NULL OR p.effective_till >= ?)
    ORDER BY p.id DESC
  `,

  GET_ATTENDANCE: `
    SELECT
      ea.employee_id,
      ea.punch_status,
      ea.punchin_time,
      ea.punchout_time,
      ea.punchout_device,
      ea.punchout_location,
      ea.punchmode,
      ea.late_login,
      DATE(COALESCE(ea.punchin_time, ea.punchout_time)) AS attendance_date,
      ep.department_id,
      d.name AS department_name
    FROM emp_attendence ea
    INNER JOIN employees e
      ON e.employee_id = ea.employee_id
    LEFT JOIN employee_professional ep
      ON ep.employee_id = e.employee_id
    LEFT JOIN departments d
      ON d.id = ep.department_id
    WHERE e.org_id = ?
      AND DATE(COALESCE(ea.punchin_time, ea.punchout_time)) BETWEEN ? AND ?
    ORDER BY ea.employee_id, attendance_date, ea.punchin_time
  `,

  GET_APPROVED_REGULARISATIONS: `
    SELECT
      employee_id,
      regularisation_type,
      selected_dates,
      primary_date
    FROM leave_regularisation_requests
    WHERE org_id = ?
      AND status = 'Approved'
  `,
};
