const GET_EMPLOYEE_BY_EMAIL = `
  SELECT
    first_name,
    last_name,
    dob,
    CONCAT(first_name, ' ', last_name) AS full_name,
    email
  FROM employees
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))
  LIMIT 1
`;

module.exports = { GET_EMPLOYEE_BY_EMAIL };
