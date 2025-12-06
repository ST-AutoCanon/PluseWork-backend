const db = require("../config");
const queries = require("../constants/attendanceQueries");

class EmpAttendanceService {
  static async getAttendanceStats(employeeId) {
    try {
      const [rows] = await db.execute(queries.GET_ATTENDANCE_STATS, [
        employeeId,
        employeeId,
        employeeId,
      ]);

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error("Error fetching attendance stats:", error);
      throw error;
    }
  }
}

module.exports = EmpAttendanceService;
