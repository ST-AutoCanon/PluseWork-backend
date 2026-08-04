module.exports = {
  ADD_RECRUITMENT_CANDIDATE: `
    INSERT INTO recruitment_candidates (
      org_id,
      name,
      email,
      phone,
      applied_position,
      department,
      skills,
      current_ctc,
      expected_ctc,
      notice_period,
      total_experience,
      status,
      source,
      resume_url,
      offer_ctc,
      offer_letter_url,
      joining_date,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `,

  GET_RECRUITMENT_CANDIDATES: `
    SELECT *
    FROM recruitment_candidates
    WHERE org_id = ?
    ORDER BY created_at DESC
  `,

  GET_RECRUITMENT_CANDIDATE_BY_ID: `
    SELECT *
    FROM recruitment_candidates
    WHERE id = ? AND org_id = ?
    LIMIT 1
  `,

  UPDATE_RECRUITMENT_CANDIDATE: `
    UPDATE recruitment_candidates
    SET
      name = ?,
      email = ?,
      phone = ?,
      applied_position = ?,
      department = ?,
      skills = ?,
      current_ctc = ?,
      expected_ctc = ?,
      notice_period = ?,
      total_experience = ?,
      status = ?,
      source = ?,
      resume_url = ?,
      offer_ctc = ?,
      offer_letter_url = ?,
      joining_date = ?,
      updated_at = NOW()
    WHERE id = ? AND org_id = ?
  `,

  UPDATE_RECRUITMENT_STATUS: `
    UPDATE recruitment_candidates
    SET
      status = ?,
      updated_at = NOW()
    WHERE id = ? AND org_id = ?
  `,

  DELETE_RECRUITMENT_CANDIDATE: `
    DELETE FROM recruitment_candidates
    WHERE id = ? AND org_id = ?
  `,

  INSERT_RECRUITMENT_ASSESSMENT: `
INSERT INTO recruitment_assessments
(
 recruitment_candidate_id,
 org_id,
 round_name,
 interview_date,
 interview_link,
 send_interview_email,
 email_body,
 email_subject,
 created_at,
 updated_at
)
VALUES
(
 ?,?,?,?,?,?,?,?,NOW(),NOW()
)
`,

  UPDATE_RECRUITMENT_ASSESSMENT: `
UPDATE recruitment_assessments
SET
    interview_date=?,
    interview_link=?,
    send_interview_email=?,
    email_body=?,
    email_subject=?,
    updated_at=NOW()
WHERE id=?
AND org_id=?
`,

  GET_RECRUITMENT_ASSESSMENT_BY_ID: `
SELECT 
ra.*,

GROUP_CONCAT(rai.interviewer_id) interviewer_ids

FROM recruitment_assessments ra

LEFT JOIN recruitment_assessment_interviewers rai
ON rai.assessment_id=ra.id

WHERE ra.id=?
AND ra.org_id=?

GROUP BY ra.id

LIMIT 1
  `,

  GET_LATEST_RECRUITMENT_ASSESSMENT_BY_ROUND: `
    SELECT *
    FROM recruitment_assessments
    WHERE recruitment_candidate_id = ?
      AND org_id = ?
      AND (
        round_name = ?
        OR round_name LIKE CONCAT(?, ' %')
      )
    ORDER BY created_at DESC
    LIMIT 1
  `,

  GET_RECRUITMENT_ASSESSMENTS: `
    SELECT

ra.*,

GROUP_CONCAT(
DISTINCT rai.interviewer_id
) AS interviewer_ids,


JSON_ARRAYAGG(
JSON_OBJECT(
'interviewer_id',
f.interviewer_id,

'score',
f.score,

'decision',
f.decision,

'feedback',
f.feedback
)
) AS feedback


FROM recruitment_assessments ra


LEFT JOIN recruitment_assessment_interviewers rai
ON rai.assessment_id = ra.id


LEFT JOIN recruitment_assessment_feedback f
ON f.assessment_id = ra.id


WHERE 
ra.recruitment_candidate_id=?
AND ra.org_id=?


GROUP BY ra.id

ORDER BY ra.created_at DESC
  `,

  MARK_CONVERTED_TO_EMPLOYEE: `
    UPDATE recruitment_candidates
    SET
      status = 'Joined',
      joining_date = CURDATE(),
      updated_at = NOW()
    WHERE id = ? AND org_id = ?
  `,

  INSERT_EMPLOYEE_FROM_RECRUITMENT: `
    INSERT INTO employees (
      employee_id,
      first_name,
      last_name,
      email,
      phone_number,
      org_id,
      status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'Active', NOW(), NOW())
  `,

  GET_RECRUITMENT_INTERVIEWERS: `
    SELECT
      e.employee_id,
      CONCAT_WS(' ', e.first_name, e.last_name) AS name,
      e.email,
      ep.position
    FROM employees e
    LEFT JOIN employee_professional ep
      ON e.employee_id = ep.employee_id
    WHERE e.org_id = ?
      AND e.status = 'Active'
    ORDER BY e.first_name, e.last_name
  `,

  GET_ORGANIZATION_BY_ID: `
    SELECT
      id,
      name,
      contact_email_id,
      admin_email,
      subdomain,
      company_address,
      employee_prefix,
      employee_counter
    FROM organizations
    WHERE id = ?
    LIMIT 1
  `,

  GET_ASSESSMENT_FEEDBACK_BY_INTERVIEWER: `
SELECT *
FROM recruitment_assessment_feedback
WHERE assessment_id = ?
AND interviewer_id = ?
LIMIT 1
`,

  INSERT_ASSESSMENT_FEEDBACK: `
INSERT INTO recruitment_assessment_feedback (
    assessment_id,
    recruitment_candidate_id,
    org_id,
    interviewer_id,
    score,
    decision,
    feedback,
    submitted_at
)
VALUES (
    ?, ?, ?, ?, ?, ?, ?, NOW()
)
`,

  UPDATE_ASSESSMENT_FEEDBACK: `
UPDATE recruitment_assessment_feedback
SET
    score = ?,
    decision = ?,
    feedback = ?,
    submitted_at = NOW(),
    updated_at = NOW()
WHERE assessment_id = ?
AND interviewer_id = ?
`,
};
