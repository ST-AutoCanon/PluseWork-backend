// constants/policiesQueries.js

module.exports = {
  // ===========================
  // POLICY
  // ===========================
INSERT_POLICY_ASSIGNMENT: `
INSERT INTO policy_assignments (
    policy_id,
    employee_id,
    employee_name,
    department_id,
    department_name,
    assignment_type
)
VALUES (?,?,?,?,?,?)
`,
INSERT_POLICY: `
  INSERT INTO policies (
    org_id,
    policy_name,
    allow_view,
    allow_download,
    assign_to_all,
    created_by,
    created_at,
    updated_at
  )
  VALUES (
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
`,

GET_POLICIES: `
  SELECT
    id,
    org_id,
    policy_name,
    allow_view,
    allow_download,
    assign_to_all,
    created_by,
    created_at,
    updated_at
  FROM policies
  WHERE org_id = ?
  ORDER BY created_at DESC
`,

GET_POLICY_BY_ID: `
  SELECT
    id,
    org_id,
    policy_name,
    allow_view,
    allow_download,
    assign_to_all,
    created_by,
    created_at,
    updated_at
  FROM policies
  WHERE id = ?
    AND org_id = ?
  LIMIT 1
`,

  UPDATE_POLICY: `
    UPDATE policies
    SET
      policy_name = ?,
      allow_view = ?,
      allow_download = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND org_id = ?
  `,

  DELETE_POLICY: `
    DELETE
    FROM policies
    WHERE id = ?
      AND org_id = ?
  `,
UPDATE_POLICY_FILE_REPLACE: `
  UPDATE policy_files
  SET
    file_name = ?,
    original_file_name = ?,
    acknowledgement_required = ?,
    acknowledgement_message = ?,
    uploaded_at = CURRENT_TIMESTAMP
  WHERE id = ?
`,
  // ===========================
  // POLICY FILES
  // ===========================

  INSERT_POLICY_FILE: `
    INSERT INTO policy_files (
      policy_id,
      file_type,
      file_name,
      original_file_name,
      acknowledgement_required,
      acknowledgement_message,
      uploaded_at
    )
    VALUES (
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      CURRENT_TIMESTAMP
    )
  `,

  GET_POLICY_FILES: `
    SELECT
      id,
      policy_id,
      file_type,
      file_name,
      original_file_name,
      acknowledgement_required,
      acknowledgement_message,
      uploaded_at
    FROM policy_files
    WHERE policy_id = ?
    ORDER BY uploaded_at DESC
  `,

  GET_POLICY_FILE_BY_ID: `
    SELECT
      id,
      policy_id,
      file_type,
      file_name,
      original_file_name,
      acknowledgement_required,
      acknowledgement_message,
      uploaded_at
    FROM policy_files
    WHERE id = ?
    LIMIT 1
  `,

  DELETE_POLICY_FILE: `
    DELETE
    FROM policy_files
    WHERE id = ?
  `,

  DELETE_POLICY_FILES_BY_POLICY: `
    DELETE
    FROM policy_files
    WHERE policy_id = ?
  `,

  UPDATE_ACKNOWLEDGEMENT: `
    UPDATE policy_files
    SET
      acknowledgement_required = ?,
      acknowledgement_message = ?
    WHERE id = ?
  `,

  GET_POLICY_FILE_COUNT: `
    SELECT
      COUNT(*) AS totalFiles
    FROM policy_files
    WHERE policy_id = ?
  `,
  // Inside module.exports = { ... }
UPDATE_POLICY_FILE_ACKNOWLEDGEMENT: `
  UPDATE policy_files
  SET
    acknowledgement_required = ?,
    acknowledgement_message = ?,
    uploaded_at = CURRENT_TIMESTAMP   -- optional: update timestamp
  WHERE id = ?
`,
};