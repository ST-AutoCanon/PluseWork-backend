module.exports = {
  /* forgot-password queries*/
  GET_EMPLOYEE_BY_EMAIL: `SELECT *
  FROM employees
  WHERE email = ?
    AND status = 'Active';
  `,
  SAVE_RESET_TOKEN: `
  INSERT INTO password_resets (email, token, expiry_time) 
  VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))
  ON DUPLICATE KEY UPDATE 
    token = VALUES(token), 
    expiry_time = VALUES(expiry_time)
`,
  VERIFY_RESET_TOKEN: `
  SELECT email 
  FROM password_resets 
  WHERE token = ? AND expiry_time > NOW();
  `,
  UPDATE_EMPLOYEE_PASSWORD: `
    UPDATE employees 
    SET password = ? 
    WHERE email = ?;
  `,

  ADD_DEPARTMENT:
    "INSERT INTO departments (name, icon, org_id) VALUES (?, ?, ?)",
  GET_DEPARTMENTS: "SELECT * FROM departments WHERE Org_id = ?",

  GET_HOLIDAYS:
    "SELECT date, occasion, type FROM holidays WHERE YEAR(date) = YEAR(CURDATE())",
};
