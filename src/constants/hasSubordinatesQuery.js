module.exports = {
  CHECK_EMPLOYEE_SUBORDINATES: `
    SELECT COUNT(*) AS count
    FROM employee_professional
    WHERE supervisor_id = ?
  `,
};
