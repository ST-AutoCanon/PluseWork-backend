module.exports = {
  getSalarySlipQuery: (tableName) =>
    `SELECT * FROM ${tableName} WHERE employee_id = ?`,

  GETEMPLOYEEBANKDETAILSQUERY: `SELECT * FROM employee_bank_details WHERE employee_id = ?`,
  GET_EMPLOYEE_DETAILS_QUERY: `
  SELECT e.*, ep.*
  FROM employees e
  LEFT JOIN employee_personal ep
    ON e.employee_id = ep.employee_id
  WHERE e.employee_id = ?
`,
};
