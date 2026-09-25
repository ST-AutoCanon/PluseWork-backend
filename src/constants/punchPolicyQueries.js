const PUNCH_POLICY_QUERIES = {
  LIST_POLICIES: `
    SELECT
      id,
      org_id,
      policy_name,
      description,
      policy_type,
      applies_to,
      deduction_basis,
      deduction_type,
      deduction_value,
      rounding,
      apply_grace_time,
      grace_minutes,
      min_duration,
      mark_as_half_day,
      TIME_FORMAT(half_day_after, '%H:%i') AS half_day_after,
      half_day_operator,
      mark_as_full_day,
      TIME_FORMAT(full_day_after, '%H:%i') AS full_day_after,
      full_day_operator,
      policy_status,
      DATE_FORMAT(effective_from, '%Y-%m-%d') AS effective_from,
      DATE_FORMAT(effective_till, '%Y-%m-%d') AS effective_till,
      rules,
      excuses,
      created_by,
      updated_by,
      DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
      DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
    FROM punch_policies
    WHERE org_id = ?
      AND deleted_at IS NULL
    ORDER BY created_at DESC
  `,

  GET_POLICY_BY_ID: `
    SELECT
      id,
      org_id,
      policy_name,
      description,
      policy_type,
      applies_to,
      deduction_basis,
      deduction_type,
      deduction_value,
      rounding,
      apply_grace_time,
      grace_minutes,
      min_duration,
      mark_as_half_day,
      TIME_FORMAT(half_day_after, '%H:%i') AS half_day_after,
      half_day_operator,
      mark_as_full_day,
      TIME_FORMAT(full_day_after, '%H:%i') AS full_day_after,
      full_day_operator,
      policy_status,
      DATE_FORMAT(effective_from, '%Y-%m-%d') AS effective_from,
      DATE_FORMAT(effective_till, '%Y-%m-%d') AS effective_till,
      rules,
      excuses,
      created_by,
      updated_by,
      DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
      DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
    FROM punch_policies
    WHERE id = ?
      AND org_id = ?
      AND deleted_at IS NULL
    LIMIT 1
  `,

  INSERT_POLICY: `
    INSERT INTO punch_policies (
      org_id,
      policy_name,
      description,
      policy_type,
      applies_to,
      deduction_basis,
      deduction_type,
      deduction_value,
      rounding,
      apply_grace_time,
      grace_minutes,
      min_duration,
      mark_as_half_day,
      half_day_after,
      half_day_operator,
      mark_as_full_day,
      full_day_after,
      full_day_operator,
      policy_status,
      effective_from,
      effective_till,
      rules,
      excuses,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,

  UPDATE_POLICY: `
    UPDATE punch_policies
    SET
      policy_name = ?,
      description = ?,
      policy_type = ?,
      applies_to = ?,
      deduction_basis = ?,
      deduction_type = ?,
      deduction_value = ?,
      rounding = ?,
      apply_grace_time = ?,
      grace_minutes = ?,
      min_duration = ?,
      mark_as_half_day = ?,
      half_day_after = ?,
      half_day_operator = ?,
      mark_as_full_day = ?,
      full_day_after = ?,
      full_day_operator = ?,
      policy_status = ?,
      effective_from = ?,
      effective_till = ?,
      rules = ?,
      excuses = ?,
      updated_by = ?,
      updated_at = NOW()
    WHERE id = ?
      AND org_id = ?
      AND deleted_at IS NULL
  `,

  SOFT_DELETE_POLICY: `
    UPDATE punch_policies
    SET
      deleted_at = NOW(),
      updated_by = ?,
      updated_at = NOW()
    WHERE id = ?
      AND org_id = ?
      AND deleted_at IS NULL
  `,

  GET_ASSIGNMENTS_BY_POLICY: `
    SELECT
      id,
      policy_id,
      org_id,
      assignment_type,
      reference_id,
      reference_name,
      DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
    FROM punch_policy_assignments
    WHERE policy_id = ?
      AND org_id = ?
    ORDER BY id ASC
  `,

  DELETE_ASSIGNMENTS_BY_POLICY: `
    DELETE FROM punch_policy_assignments
    WHERE policy_id = ?
      AND org_id = ?
  `,

  INSERT_ASSIGNMENT: `
    INSERT INTO punch_policy_assignments (
      policy_id,
      org_id,
      assignment_type,
      reference_id,
      reference_name
    ) VALUES (?, ?, ?, ?, ?)
  `,

  GET_EXCLUSIONS_BY_POLICY: `
    SELECT
      id,
      policy_id,
      org_id,
      exclusion_type,
      reference_id,
      reference_name,
      DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
    FROM punch_policy_exclusions
    WHERE policy_id = ?
      AND org_id = ?
    ORDER BY id ASC
  `,

  DELETE_EXCLUSIONS_BY_POLICY: `
    DELETE FROM punch_policy_exclusions
    WHERE policy_id = ?
      AND org_id = ?
  `,

  INSERT_EXCLUSION: `
    INSERT INTO punch_policy_exclusions (
      policy_id,
      org_id,
      exclusion_type,
      reference_id,
      reference_name
    ) VALUES (?, ?, ?, ?, ?)
  `,

  CHECK_POLICY_NAME_EXISTS: `
    SELECT id
    FROM punch_policies
    WHERE org_id = ?
      AND LOWER(TRIM(policy_name)) = LOWER(TRIM(?))
      AND deleted_at IS NULL
      AND (? IS NULL OR id != ?)
    LIMIT 1
  `,

  GET_DEPARTMENTS: `
    SELECT id, name
    FROM departments
    WHERE org_id = ? OR org_id IS NULL
    ORDER BY name
  `,

  GET_EMPLOYEES_FOR_ASSIGNMENT: `
    SELECT
      e.employee_id,
      CONCAT_WS(' ', e.first_name, e.middle_name, e.last_name) AS name,
      e.email,
      d.name AS department,
      pr.department_id
    FROM employees e
    LEFT JOIN employee_professional pr ON e.employee_id = pr.employee_id
    LEFT JOIN departments d ON pr.department_id = d.id
    WHERE e.org_id = ?
      AND e.status = 'Active'
    ORDER BY e.first_name, e.last_name
    LIMIT 500
  `,

  SEARCH_EMPLOYEES_FOR_ASSIGNMENT: `
    SELECT
      e.employee_id,
      CONCAT_WS(' ', e.first_name, e.middle_name, e.last_name) AS name,
      e.email,
      d.name AS department,
      pr.department_id
    FROM employees e
    LEFT JOIN employee_professional pr ON e.employee_id = pr.employee_id
    LEFT JOIN departments d ON pr.department_id = d.id
    WHERE e.org_id = ?
      AND e.status = 'Active'
      AND (
        e.first_name LIKE ? OR
        e.last_name LIKE ? OR
        e.email LIKE ? OR
        e.employee_id LIKE ? OR
        d.name LIKE ?
      )
    ORDER BY e.first_name, e.last_name
    LIMIT 100
  `,
};

module.exports = PUNCH_POLICY_QUERIES;
