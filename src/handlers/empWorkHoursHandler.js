const { getWorkHourSummary } = require("../services/empWorkHourService");

const getWorkHourSummaryHandler = async (req, res) => {
  const { employeeId } = req.params;

  if (!employeeId) {
    return res.status(400).json({ error: "Employee ID is required" });
  }

  try {
    const result = await getWorkHourSummary(employeeId);

    if (!result || result.length === 0) {
      return res
        .status(404)
        .json({ message: "No work hour summary found for this employee" });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ Error fetching work hour summary:", error);
    return res
      .status(500)
      .json({ error: error.message || "Internal server error" });
  }
};

module.exports = {
  getWorkHourSummaryHandler,
};
