// handler/overtimeSummaryHandler.js
const { getOvertimeSummaryService } = require("../services/overtimeSummaryService");

/**
 * Handler to get overtime summary for a supervisor
 */
const getOvertimeSummaryHandler = async (req, res) => {
  try {
    const supervisorId = req.headers["x-employee-id"]; // Taking supervisorId from request header
    
    if (!supervisorId) {
      return res.status(400).json({ error: "Supervisor ID is required in x-employee-id header" });
    }

    const summary = await getOvertimeSummaryService(supervisorId);

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error fetching overtime summary:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
};

module.exports = { getOvertimeSummaryHandler };
