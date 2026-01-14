const db = require("../config");
const {
  OVERTIME_SUMMARY_QUERY,
} = require("../constants/overtimeSummaryquerry");

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
