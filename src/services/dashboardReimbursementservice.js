const db = require("../config");
const queries = require("../constants/loginQueries");

const getReimbursementStats = async (employeeId) => {
  try {
    const [rows] = await db.execute(queries.GET_REIMBURSEMENT_STATS, [
      employeeId,
    ]);
    return rows[0];
  } catch (error) {
    console.error("Error fetching reimbursement stats:", error);
    throw new Error("Database query failed");
  }
};

module.exports = {
  getReimbursementStats,
};
