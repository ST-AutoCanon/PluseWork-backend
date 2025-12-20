// Raw SQL queries for salary_calculation_period table
// Use parameterized queries to avoid SQL injection

const ADD_SALARY_PERIOD = `
  INSERT INTO salary_calculation_period (cutoff_date) VALUES (?) 
  ON DUPLICATE KEY UPDATE cutoff_date = VALUES(cutoff_date), updated_at = CURRENT_TIMESTAMP
`;

const GET_ALL_SALARY_PERIODS = `
  SELECT id, cutoff_date, created_at, updated_at 
  FROM salary_calculation_period 
  ORDER BY id ASC
`;

const UPDATE_SALARY_PERIOD = `
  UPDATE salary_calculation_period 
  SET cutoff_date = ?, updated_at = CURRENT_TIMESTAMP 
  WHERE id = ?
`;

const GET_SALARY_PERIOD_BY_ID = `
  SELECT id, cutoff_date, created_at, updated_at 
  FROM salary_calculation_period 
  WHERE id = ?
`;

module.exports = {
  ADD_SALARY_PERIOD,
  GET_ALL_SALARY_PERIODS,
  UPDATE_SALARY_PERIOD,
  GET_SALARY_PERIOD_BY_ID,
};