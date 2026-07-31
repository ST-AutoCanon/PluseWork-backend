const GET_EMPLOYEE_POLICIES = `
SELECT DISTINCT
    p.id AS policy_id,
    p.policy_name,
    p.allow_view,
    p.allow_download,
    p.assign_to_all,
    p.created_at
  FROM policies p
  LEFT JOIN policy_assignments pa
    ON pa.policy_id = p.id
   AND pa.employee_id = ?
  WHERE p.org_id = ?
    AND (
      p.assign_to_all = 1
      OR pa.id IS NOT NULL
    )
  ORDER BY p.created_at DESC
`;

const GET_POLICY_FILES = `
SELECT
    pf.id,
    pf.policy_id,
    pf.file_type,
    pf.file_name,
    pf.original_file_name,
    pf.acknowledgement_required,
    pf.acknowledgement_message,
    p.allow_view,
    p.allow_download
FROM policy_files pf
INNER JOIN policies p
    ON pf.policy_id = p.id
WHERE
    pf.policy_id = ?
AND
    p.org_id = ?
AND
    p.allow_view = 1
ORDER BY pf.uploaded_at;
`;

const GET_POLICY_FILE_BY_ID = `
SELECT
    pf.id,
    pf.policy_id,
    pf.file_type,
    pf.file_name,
    pf.original_file_name,
    pf.acknowledgement_required,
    pf.acknowledgement_message,
    p.allow_view,
    p.allow_download
FROM policy_files pf
INNER JOIN policies p
    ON pf.policy_id = p.id
WHERE
    pf.id = ?
AND
    p.org_id = ?
LIMIT 1;
`;

const SAVE_ACKNOWLEDGEMENT = `
INSERT INTO policy_acknowledgements
(
    org_id,
    employee_id,
    policy_id,
    policy_file_id,
    acknowledged
)
VALUES
(
    ?, ?, ?, ?, 1
);
`;

const CHECK_ACKNOWLEDGEMENT = `
SELECT
    id,
    acknowledged,
    acknowledged_at
FROM policy_acknowledgements
WHERE
    org_id = ?
AND
    employee_id = ?
AND
    policy_file_id = ?
LIMIT 1;
`;

const GET_EMPLOYEE_POLICY_HISTORY = `
SELECT
    p.policy_name,
    pf.original_file_name,
    pa.acknowledged,
    pa.acknowledged_at
FROM policy_acknowledgements pa
INNER JOIN policies p
    ON pa.policy_id = p.id
INNER JOIN policy_files pf
    ON pa.policy_file_id = pf.id
WHERE
    pa.org_id = ?
AND
    pa.employee_id = ?
ORDER BY pa.acknowledged_at DESC;
`;

module.exports = {
    GET_EMPLOYEE_POLICIES,
    GET_POLICY_FILES,
    GET_POLICY_FILE_BY_ID,
    SAVE_ACKNOWLEDGEMENT,
    CHECK_ACKNOWLEDGEMENT,
    GET_EMPLOYEE_POLICY_HISTORY,
};