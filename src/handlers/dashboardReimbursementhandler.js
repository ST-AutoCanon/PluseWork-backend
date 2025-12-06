const reimbursementService = require("../services/dashboardReimbursementservice");

const getReimbursementStats = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const stats = await reimbursementService.getReimbursementStats(employeeId);

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
