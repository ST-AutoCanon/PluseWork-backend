module.exports = {
 GET_EMPLOYEE_DETAILS_QUERY: `
  SELECT 
    ep.gender,
    epro.joining_date,
    epro.position AS designation,
    ep.pf_number,
    ep.esi_number,
    ep.uan_number,
    ep.pan_number,
    epro.department_id,
    d.name AS department_name,
    CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')) AS full_name,
    e.employee_id
  FROM employees e
  LEFT JOIN employee_personal ep ON e.employee_id = ep.employee_id
  LEFT JOIN employee_professional epro ON e.employee_id = epro.employee_id
  LEFT JOIN departments d ON d.id = epro.department_id
  WHERE e.employee_id = ?
  LIMIT 1
`,

  GETEMPLOYEEBANKDETAILSQUERY: `
  SELECT
    COALESCE(ebd.bank_name, '') AS bank_name,
    COALESCE(ebd.account_number, '') AS account_number,
    COALESCE(ebd.ifsc_code, '') AS ifsc_code,
    COALESCE(ebd.branch_name, '') AS branch_name,
    CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')) AS employee_name,
    COALESCE(ep.pan_number, '') AS pan_number
  FROM employee_bank_details ebd
  LEFT JOIN employees e ON ebd.employee_id = e.employee_id
  LEFT JOIN employee_personal ep ON ebd.employee_id = ep.employee_id
  WHERE ebd.employee_id = ?
  LIMIT 1
`,
  GET_APPROVED_PAYROLL_LEAVE_COUNT: `
  SELECT COALESCE(SUM(
    CASE
      WHEN LOWER(COALESCE(lq.H_F_day, '')) LIKE '%half%'
        AND lq.start_date = lq.end_date
        AND lq.start_date BETWEEN ? AND ?
        THEN 0.5
      ELSE 1
    END
  ), 0) AS approved_leave_count
  FROM leavequeries lq
  LEFT JOIN leave_types lt
    ON lt.org_id = lq.org_id
    AND (
      LOWER(lt.type_key) = LOWER(lq.leave_type)
      OR LOWER(lt.display_name) = LOWER(lq.leave_type)
    )
  WHERE lq.employee_id = ?
    AND lq.org_id = ?
    AND LOWER(lq.status) = 'approved'
    AND lq.start_date <= ?
    AND lq.end_date >= ?
    AND (
      LOWER(COALESCE(lq.leave_type, '')) LIKE '%sick%'
      OR LOWER(COALESCE(lq.leave_type, '')) LIKE '%casual%'
      OR LOWER(COALESCE(lq.leave_type, '')) LIKE '%earned%'
      OR LOWER(COALESCE(lt.type_key, '')) LIKE '%sick%'
      OR LOWER(COALESCE(lt.type_key, '')) LIKE '%casual%'
      OR LOWER(COALESCE(lt.type_key, '')) LIKE '%earned%'
      OR LOWER(COALESCE(lt.display_name, '')) LIKE '%sick%'
      OR LOWER(COALESCE(lt.display_name, '')) LIKE '%casual%'
      OR LOWER(COALESCE(lt.display_name, '')) LIKE '%earned%'
    )
`,
};
