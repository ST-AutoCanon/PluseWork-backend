const LeaveQueriesService = require("../services/leaveQueriesService");

const getLeaveQueriesHandler = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      return res
        .status(400)
        .json({ status: "error", message: "Employee ID is required" });
    }

    const leaveQueries = await LeaveQueriesService.getLeaveQueriesForDashboard(
      employeeId
    );

    if (!leaveQueries || leaveQueries.length === 0) {
      return res.status(200).json({
        status: "success",
        message: "No leave queries found for the given employee ID.",
        leaveQueries: [], // Returning an empty array instead of an error
      });
    }

    res.status(200).json({
      status: "success",
      message: "Employee leave queries fetched successfully.",
      leaveQueries,
    });
  } catch (error) {
    console.error("Error fetching leave queries for dashboard:", error);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
  }
};

module.exports = {
  getLeaveQueriesHandler,
};
