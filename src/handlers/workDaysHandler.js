
const EmpAttendanceService = require("../services/empWorkDayService");

const extractOrgId = (req) =>
  req.headers["x-org-id"] ||
  req.query.orgId ||
  (req.user && (req.user.orgId || req.user.Org_id || req.user.org_id));

const getAttendanceStatsHandler = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const orgId = extractOrgId(req);

    if (!employeeId) {
      return res.status(400).json({ status: "error", message: "Employee ID is required" });
    }
    if (!orgId) {
      return res.status(400).json({ status: "error", message: "orgId is required" });
    }

    const attendanceStats = await EmpAttendanceService.getAttendanceStats(employeeId, orgId);

    if (!attendanceStats) {
      return res.status(404).json({ status: "error", message: "No attendance data found for the given employee ID" });
    }

    res.status(200).json({
      status: "success",
      message: "Attendance statistics fetched successfully.",
      attendanceStats,
    });
  } catch (error) {
    console.error("Error fetching attendance statistics:", error);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
  }
};

module.exports = {
  getAttendanceStatsHandler,
};
