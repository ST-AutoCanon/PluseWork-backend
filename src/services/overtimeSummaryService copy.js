const db = require("../config");
const { OVERTIME_SUMMARY_QUERY } = require("../constants/overtimeSummaryquerry");

/**
 * Get overtime summary for a supervisor
 * @param {string} supervisorId - Employee ID of the supervisor
 * @returns {Promise<Array>} - List of employees with their assigned projects
 */
const getOvertimeSummaryService = async (supervisorId) => {
    try {
        console.log("[SERVICE] Running query with supervisorId:", supervisorId);
        const [results] = await db.query(OVERTIME_SUMMARY_QUERY, [supervisorId]);
        console.log("[SERVICE] Query results:", results);
        return results;
    } catch (error) {
        console.error("[SERVICE] Error:", error);
        throw error;
    }
};


module.exports = { getOvertimeSummaryService };
