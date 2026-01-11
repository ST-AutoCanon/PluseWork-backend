module.exports = {
  /* ==============================
     EMPLOYEE DETAILS
  ============================== */
 
  GET_EMPLOYEE_DETAILS_QUERY: `
  SELECT
    a.date,
    a.login_time,
    a.logout_time,
    a.location,
    CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')) AS employee_name
  FROM attendance a
  LEFT JOIN employees e ON a.employee_id = e.employee_id
  WHERE a.employee_id = ?
  ORDER BY a.date DESC
`,


  /* ==============================
     EMPLOYEE BANK DETAILS
  ============================== */
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
