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
    CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')) AS full_name,
    e.employee_id
  FROM employees e
  LEFT JOIN employee_personal ep ON e.employee_id = ep.employee_id
  LEFT JOIN employee_professional epro ON e.employee_id = epro.employee_id
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
};
