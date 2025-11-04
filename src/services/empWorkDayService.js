const db = require("../config");
const queries = require("../constants/attendanceQueries");

class EmpAttendanceService {
  /**
   * Fetch attendance statistics for an employee.
   *
   * @param {string} employeeId - The ID of the employee.
   * @returns {Promise<Object>} Attendance stats (total working days, leave count, present count, absent count).
   */
  static async getAttendanceStats(employeeId) {
    try {
      const [rows] = await db.execute(queries.GET_ATTENDANCE_STATS, [
        employeeId,
        employeeId,
        employeeId,
      ]);

      return rows.length > 0 ? rows[0] : null; // Return first row if exists
    } catch (error) {
      console.error("Error fetching attendance stats:", error);
      throw error;
    }
  }
}

module.exports = EmpAttendanceService;
