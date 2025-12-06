const db = require("../config");
const attendanceQueries = require("../constants/attendanceQueries");

const attendanceService = {
  getTodayPunchRecords: async (employeeId) => {
    try {
      const [rows] = await db.execute(
        attendanceQueries.GET_TODAY_PUNCH_RECORDS,
        [employeeId]
      );
      return rows;
    } catch (error) {
      console.error("Error fetching today's punch records:", error);
      throw error;
    }
  },
};

module.exports = attendanceService;
