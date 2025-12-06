const pool = require("../config");
const { workHourSummaryQuery } = require("../constants/attendanceQueries");

async function getWorkHourSummary(employeeId) {
  try {
    const [rows] = await pool.execute(workHourSummaryQuery, [
      employeeId,
      employeeId,
      employeeId,
    ]);
    return rows;
  } catch (error) {
    console.error("❌ Error fetching work hour summary:", error);
    throw error;
  }
}

module.exports = { getWorkHourSummary };
