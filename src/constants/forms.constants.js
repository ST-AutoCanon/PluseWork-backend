
const FORM_QUERIES = {
  CREATE_FORM: `
    INSERT INTO form_templates (form_name, form_json, layout, form_type, active_from, active_to)
    VALUES (?, ?, ?, ?, ?, ?)
  `,

  UPDATE_FORM: `
    UPDATE form_templates
    SET form_name = ?, 
        form_json = ?, 
        layout = ?, 
        form_type = ?, 
        active_from = ?,
        active_to = ?
    WHERE id = ?
  `,

  GET_FORMS: `
    SELECT id, form_name, layout, form_type, active_from, active_to, created_at
    FROM form_templates
    ORDER BY created_at DESC
  `,

  GET_FORM_BY_ID: `
    SELECT *, 
           IFNULL(active_from, '1900-01-01') AS active_from,
           IFNULL(active_to,   '9999-12-31') AS active_to
    FROM form_templates
    WHERE id = ?
  `,

  // Legacy queries (for old forms without date range)
  CREATE_FORM_LEGACY: `
    INSERT INTO form_templates (form_name, form_json, layout)
    VALUES (?, ?, ?)
  `,

  UPDATE_FORM_LEGACY: `
    UPDATE form_templates
    SET form_name = ?, form_json = ?, layout = ?
    WHERE id = ?
  `,

  SUBMIT_RESPONSE: `
    INSERT INTO form_responses1 (form_id, employee_id, org_id, response_json)
    VALUES (?, ?, ?, ?)
  `,

  GET_RESPONSES: `
    SELECT *
    FROM form_responses1
    WHERE form_id = ? AND org_id = ?
    ORDER BY submitted_at DESC
  `,

  GET_RESPONSE_BY_FORM_EMPLOYEE: `
    SELECT *
    FROM form_responses1
    WHERE form_id = ? AND employee_id = ? AND org_id = ?
    LIMIT 1
  `,

  UPDATE_RESPONSE: `
    UPDATE form_responses1
    SET response_json = ?, submitted_at = NOW()
    WHERE id = ?
  `,

 ASSIGN_FORM_TO_EMPLOYEES: `
  INSERT INTO form_assignments 
    (form_id, org_id, assigned_to_type, assigned_to_id, assigned_at) 
  VALUES (?, ?, ?, ?, NOW())
`,
 

  DELETE_EMPLOYEE_ASSIGNMENTS: `
    DELETE FROM form_assignments 
    WHERE form_id = ? 
      AND assigned_to_type = 'EMPLOYEE'
  `,

 GET_ASSIGNED_FORMS: `
  SELECT 
    ft.id,
    ft.form_name,
    ft.layout,
    ft.form_type,
    ft.active_from,
    ft.active_to
  FROM form_assignments fa
  INNER JOIN form_templates ft 
    ON fa.form_id = ft.id
  WHERE fa.assigned_to_type = 'EMPLOYEE'
    AND fa.assigned_to_id COLLATE utf8mb4_0900_ai_ci = ?
  ORDER BY ft.id DESC
`,
};

module.exports = FORM_QUERIES;