const attendanceService = require("../services/employeeloginService");

const getTodayAndYesterdayPunchData = async (req, res) => {
  try {
    const { org_id } = req.query; // Extract org_id from query parameters
    if (!org_id) {
      return res
        .status(400)
        .json({ success: false, message: "org_id is required" });
    }
    const punchData = await attendanceService.fetchTodayAndYesterdayData(
      org_id
    );
    res.status(200).json({ success: true, data: punchData });
  } catch (error) {
    console.error("[TODAY_YESTERDAY_PUNCHES] Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getTodayAndYesterdayPunchData,
};
