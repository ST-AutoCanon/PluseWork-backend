const GET_EMPLOYEE_POLICIES = `
SELECT DISTINCT
    p.id AS policy_id,
    p.policy_name,
    p.description,          -- ← add this
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
    pf.allow_view,          -- ← changed from p.allow_view
    pf.allow_download,      -- ← changed from p.allow_download
    CASE 
      WHEN pa.id IS NOT NULL AND pa.acknowledged = 1 THEN 1 
      ELSE 0 
        END AS is_acknowledged,
        CASE
            WHEN pa.id IS NOT NULL AND pa.read_completed = 1 THEN 1
            ELSE 0
        END AS is_read
FROM policy_files pf
INNER JOIN policies p
    ON pf.policy_id = p.id
LEFT JOIN policy_acknowledgements pa
    ON pa.policy_file_id = pf.id
   AND pa.employee_id = ?
   AND pa.org_id = ?
WHERE
    pf.policy_id = ?
AND
    p.org_id = ?
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
    pf.allow_view,          -- ← changed from p.allow_view
    pf.allow_download       -- ← changed from p.allow_download
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
    read_completed,
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

const SAVE_READ_COMPLETION = `
UPDATE policy_acknowledgements
SET
    read_completed = 1,
    read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
WHERE org_id = ? AND employee_id = ? AND policy_id = ? AND policy_file_id = ?;
`;

const GET_POLICY_READING_STATUS = `
SELECT
        e.employee_id,
        CONCAT_WS(' ', e.first_name, e.last_name) AS employee_name,
        COUNT(pf.id) AS total_files,
        COUNT(CASE WHEN pa.read_completed = 1 THEN 1 END) AS read_files,
        COUNT(CASE WHEN pf.acknowledgement_required = 1 THEN 1 END) AS required_ack_files,
        COUNT(CASE WHEN pf.acknowledgement_required = 1 AND pa.acknowledged = 1 THEN 1 END) AS acknowledged_files
FROM employees e
JOIN (
        /* Only employees that were explicitly assigned (works for both pure-employee and partial-department cases) */
        SELECT DISTINCT pa.employee_id
        FROM policy_assignments pa
        WHERE pa.policy_id = ? AND pa.employee_id IS NOT NULL

        UNION

        /* Assign-to-all case */
        SELECT e3.employee_id
        FROM employees e3
        WHERE e3.status = 'Active' AND e3.org_id = ?
          AND EXISTS (SELECT 1 FROM policies p3 WHERE p3.id = ? AND p3.assign_to_all = 1)
) assigned ON assigned.employee_id = e.employee_id
CROSS JOIN policy_files pf
LEFT JOIN policy_acknowledgements pa
    ON pa.policy_file_id = pf.id
   AND pa.employee_id = e.employee_id
   AND pa.org_id = ?
WHERE pf.policy_id = ?
  AND e.org_id = ?
GROUP BY e.employee_id, e.first_name, e.last_name
ORDER BY employee_name ASC;
`;
const GET_POLICY_FILE_READING_STATUS = `
SELECT
  e.employee_id,
  CONCAT_WS(' ', e.first_name, e.last_name) AS employee_name,
  pf.id AS file_id,
  pf.original_file_name,
  pf.file_name,
  pf.acknowledgement_required,
  CASE WHEN pa.read_completed = 1 THEN 1 ELSE 0 END AS is_read,
  CASE WHEN pa.acknowledged = 1 THEN 1 ELSE 0 END AS is_acknowledged
FROM policy_files pf
CROSS JOIN (
  /* Employees explicitly assigned to this policy */
  SELECT DISTINCT pa.employee_id
  FROM policy_assignments pa
  WHERE pa.policy_id = ?
    AND pa.employee_id IS NOT NULL

  UNION

  /* Assign-to-all case */
  SELECT e3.employee_id
  FROM employees e3
  WHERE e3.status = 'Active'
    AND e3.org_id = ?
    AND EXISTS (
      SELECT 1 FROM policies p3
      WHERE p3.id = ? AND p3.assign_to_all = 1
    )
) assigned
JOIN employees e
  ON e.employee_id = assigned.employee_id
 AND e.org_id = ?
LEFT JOIN policy_acknowledgements pa
  ON pa.policy_file_id = pf.id
 AND pa.employee_id = e.employee_id
 AND pa.org_id = ?
WHERE pf.policy_id = ?
ORDER BY pf.id, employee_name;
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
    SAVE_READ_COMPLETION,
    GET_POLICY_READING_STATUS,
    GET_EMPLOYEE_POLICY_HISTORY,GET_POLICY_FILE_READING_STATUS
};