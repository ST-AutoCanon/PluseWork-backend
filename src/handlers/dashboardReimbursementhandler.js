const reimbursementService = require("../services/dashboardReimbursementservice");

const extractOrgId = (req) =>
  req.headers["x-org-id"] ||
  req.query.orgId ||
  (req.user && (req.user.orgId || req.user.Org_id || req.user.org_id));

const getReimbursementStats = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const orgId = extractOrgId(req);

    if (!orgId) {
      return res.status(400).json({ message: "orgId is required" });
    }

    const stats = await reimbursementService.getReimbursementStats(employeeId, orgId);

    const formattedResponse = {
      currentMonth: {
        labels: ["Pending", "Approved", "Rejected"],
        data: [
          stats.current_pending,
          stats.current_approved,
          stats.current_rejected,
        ],
      },
      previousMonth: {
        labels: ["Pending", "Approved", "Rejected"],
        data: [stats.prev_pending, stats.prev_approved, stats.prev_rejected],
      },
    };

    return res.status(200).json(formattedResponse);
  } catch (error) {
    console.error("Error fetching reimbursement stats:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = { getReimbursementStats };
