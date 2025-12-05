const db = require("../config");
const {
  getTodayAndYesterdayPunchDataQuery,
} = require("../constants/employeeloginQueries");

const fetchTodayAndYesterdayData = async (org_id) => {
  try {
    const [rows] = await db.query(getTodayAndYesterdayPunchDataQuery, [org_id]);
    return rows;
  } catch (error) {
    console.error("Error fetching punch data:", error);
    throw error;
  }
};

module.exports = {
  fetchTodayAndYesterdayData,
};
