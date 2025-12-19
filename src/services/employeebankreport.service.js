// employeebankreport.service.js
const db = require('./../config'); // Adjust path to your database config as needed

async function getEmployeePersonalDetails(employeeIds) {
  if (!employeeIds || employeeIds.length === 0) {
    return [];
  }
  const placeholders = employeeIds.map(() => '?').join(',');
  const query = `SELECT employee_id, pan_number, uan_number FROM employee_personal WHERE employee_id IN (${placeholders})`;
  const [rows] = await db.execute(query, employeeIds);
  return rows;
}

module.exports = { getEmployeePersonalDetails };