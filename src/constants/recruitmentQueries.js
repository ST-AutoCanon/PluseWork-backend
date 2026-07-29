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
    INSERT INTO recruitment_assessments (
      recruitment_candidate_id,
      org_id,
      round_name,
      interviewer_id,
      interview_date,
      interview_link,
      send_interview_email,
      email_body,
      email_subject,
      score,
      decision,
      feedback,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `,

  UPDATE_RECRUITMENT_ASSESSMENT: `
    UPDATE recruitment_assessments
    SET
      interviewer_id = ?,
      interview_date = ?,
      interview_link = ?,
      send_interview_email = ?,
      email_body = ?,
      email_subject = ?,
      score = ?,
      decision = ?,
      feedback = ?,
      updated_at = NOW()
    WHERE id = ? AND org_id = ?
  `,

  GET_RECRUITMENT_ASSESSMENT_BY_ID: `
    SELECT
    *,
    CASE
        WHEN interviewer_id IS NULL OR interviewer_id = ''
        THEN JSON_ARRAY()
        ELSE JSON_ARRAYAGG(interviewer_id)
    END AS interviewer_ids
FROM recruitment_assessments
WHERE recruitment_candidate_id = ?
AND org_id = ?
GROUP BY id
ORDER BY created_at DESC
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
    SELECT *
    FROM recruitment_assessments
    WHERE recruitment_candidate_id = ?
      AND org_id = ?
    ORDER BY created_at DESC
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
};
