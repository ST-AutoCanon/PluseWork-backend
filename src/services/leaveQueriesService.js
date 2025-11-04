const db = require("../config");
const queries = require("../constants/loginQueries");

class LeaveQueriesService {
  /**
   * Retrieve the recent 5 leave queries of a specific employee for the dashboard.
   *
   * @param {string} employee_id - ID of the employee.
   * @returns {Promise<Array>} List of recent leave queries.
   */
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
