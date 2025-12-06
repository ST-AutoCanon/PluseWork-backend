const db = require("../config");
const attendanceQueries = require("../constants/attendanceQueries");

const attendanceService = {
  getEmployeeAttendance: async (employeeId) => {
    try {
      const [rows] = await db.execute(
        attendanceQueries.GET_EMPLOYEE_ATTENDANCE,
        [employeeId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  addPunchIn: async (employeeId, device, location, punchMode) => {
    try {
      const [result] = await db.execute(attendanceQueries.ADD_PUNCH_IN, [
        employeeId,
        device,
        location,
        punchMode,
      ]);
      return result.insertId;
    } catch (error) {
      throw error;
    }
  },

  updatePunchOut: async (employeeId, device, location, punchMode) => {
    try {
      const [result] = await db.execute(attendanceQueries.UPDATE_PUNCH_OUT, [
        device,
        location,
        punchMode,
        employeeId,
      ]);
      return result.affectedRows;
    } catch (error) {
      throw error;
    }
  },

  getTodayAttendance: async () => {
    try {
      const [rows] = await db.execute(attendanceQueries.GET_TODAY_ATTENDANCE);
      return rows;
    } catch (error) {
      throw error;
    }
  },

  getLastPunchStatus: async (employeeId) => {
    try {
      const [rows] = await db.execute(attendanceQueries.GET_LAST_PUNCH_STATUS, [
        employeeId,
      ]);
      return rows.length ? rows[0].punch_status : null;
    } catch (error) {
      throw error;
    }
  },

  getLatestPunchIn: async (employeeId) => {
    try {
      const [rows] = await db.execute(attendanceQueries.GET_LATEST_PUNCH_IN, [
        employeeId,
      ]);
      return rows.length ? rows[0] : null;
    } catch (error) {
      throw error;
    }
  },

  getLatestPunchOut: async (employeeId) => {
    try {
      const [rows] = await db.execute(attendanceQueries.GET_LATEST_PUNCH_OUT, [
        employeeId,
      ]);
      return rows.length ? rows[0] : null;
    } catch (error) {
      throw error;
    }
  },
  fetchLatestPunchRecord: async (employeeId) => {
    try {
      const [rows] = await db.execute(
        `SELECT employee_id, punch_status, 
              punchin_time, punchin_device, punchin_location, 
              punchout_time, punchout_device, punchout_location, 
              punchmode
       FROM emp_attendence 
       WHERE employee_id = ? 
       ORDER BY GREATEST(COALESCE(punchin_time, '0000-00-00'), COALESCE(punchout_time, '0000-00-00')) DESC 
       LIMIT 1`,
        [employeeId]
      );

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error("Database error:", error);
      throw error;
    }
  },
};

module.exports = attendanceService;
