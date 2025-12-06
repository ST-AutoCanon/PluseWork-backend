const db = require("../config");
const queries = require("../constants/loginQueries");

class LeaveQueriesService {
  static async getLeaveQueriesForDashboard(employee_id) {
    try {
      const [rows] = await db.execute(queries.GET_LEAVE_QUERIES_IN_DASHBOARD, [
        employee_id,
      ]);
      return rows;
    } catch (error) {
      console.error("Error fetching leave queries for dashboard:", error);
      throw error;
    }
  }
}

module.exports = LeaveQueriesService;
