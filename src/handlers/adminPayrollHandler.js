const { getLastMonthTotalSalary } = require("../services/adminPayrollService");

const fetchLastMonthSalary = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];
    if (!orgId) {
      return res.status(400).json({ error: "Missing x-org-id header" });
    }

    const result = await getLastMonthTotalSalary(orgId);

    if (result === null) {
      return res.status(200).json({
        message: "No data found for the previous month",
        total_salary: 0,
      });
    }

    res.status(200).json({ total_salary: result });
  } catch (error) {
    console.error("Error fetching last month's salary:", error);
    res.status(500).json({
      error: "Failed to fetch salary data",
      details: error.message,
    });
  }
};

module.exports = {
  fetchLastMonthSalary,
};
