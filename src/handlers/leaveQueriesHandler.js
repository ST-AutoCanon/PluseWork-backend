const LeaveQueriesService = require("../services/leaveQueriesService");

const extractOrgId = (req) =>
  req.headers["x-org-id"] ||
  req.query.orgId ||
  (req.user && (req.user.orgId || req.user.Org_id || req.user.org_id));

const getLeaveQueriesHandler = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const orgId = extractOrgId(req);

    if (!employeeId) {
      return res
        .status(400)
        .json({ status: "error", message: "Employee ID is required" });
    }

    if (!orgId) {
      return res
        .status(400)
        .json({
          status: "error",
          message: "Organization ID (orgId) is required",
        });
    }

    const leaveQueries = await LeaveQueriesService.getLeaveQueriesForDashboard(
      employeeId,
      orgId
    );

    return res.status(200).json({
      status: "success",
      message: leaveQueries.length
        ? "Employee leave queries fetched successfully."
        : "No leave queries found for the given employee.",
      leaveQueries,
    });
  } catch (error) {
    console.error("❌ Error fetching leave queries for dashboard:", error);

    if (error.code === "ORG_REQUIRED") {
      return res
        .status(400)
        .json({
          status: "error",
          message: "Invalid or missing organization ID",
        });
    }

    return res
      .status(500)
      .json({ status: "error", message: "Internal Server Error" });
  }
};

module.exports = { getLeaveQueriesHandler };
