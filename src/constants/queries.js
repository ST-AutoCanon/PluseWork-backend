module.exports = {
  GET_EMPLOYEE_BY_EMAIL: `SELECT *
  FROM employees
  WHERE email = ?
    AND status = 'Active';
  `,
  SAVE_RESET_TOKEN: `
  INSERT INTO password_resets (email, token, expiry_time, org_id) 
  VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), ?)
  ON DUPLICATE KEY UPDATE 
    token = VALUES(token), 
    expiry_time = VALUES(expiry_time),
    org_id = VALUES(org_id)
`,
  SAVE_RESET_TOKEN_MASTER: `
  INSERT INTO password_reset_tokens (token, org_id, created_at)
  VALUES (?, ?, NOW())
  ON DUPLICATE KEY UPDATE
    created_at = VALUES(created_at)
`,
  VERIFY_RESET_TOKEN: `
  SELECT email 
  FROM password_resets 
  WHERE token = ? AND org_id = ? AND expiry_time > NOW();
  `,
  UPDATE_EMPLOYEE_PASSWORD: `
    UPDATE employees 
    SET password = ? 
    WHERE email = ?;
  `,

  ADD_DEPARTMENT:
    "INSERT INTO departments (name, icon, org_id) VALUES (?, ?, ?)",
  GET_DEPARTMENTS: "SELECT * FROM departments WHERE org_id = ?",

  GET_HOLIDAYS: `
    SELECT 
    DATE_FORMAT(date,'%Y-%m-%d') AS date,
    date, 
    occasion, 
    type FROM holidays
     WHERE org_id = ?
       AND date >= CONCAT(YEAR(CURDATE()), '-01-01')
     ORDER BY date
  `,
  INSERT_HOLIDAYS_UPSERT:
    "INSERT INTO holidays (org_id, `date`, `occasion`, `type`) VALUES ? ON DUPLICATE KEY UPDATE occasion = VALUES(occasion), type = VALUES(type)",

  DELETE_HOLIDAYS_BY_YEARS: (yearCount) => {
    if (!yearCount || yearCount <= 0) {
      throw new Error("yearCount must be a positive integer");
    }
    const placeholders = new Array(yearCount).fill("?").join(",");
    return `DELETE FROM holidays WHERE org_id = ? AND YEAR(\`date\`) IN (${placeholders})`;
  },

  DELETE_HOLIDAYS_CURRENT_YEAR:
    "DELETE FROM holidays WHERE org_id = ? AND YEAR(`date`) = YEAR(CURDATE())",
};
