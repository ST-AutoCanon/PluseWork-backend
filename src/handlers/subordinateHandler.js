const subordinateService = require("../services/subordinateService");

const getSubordinateStatus = async (req, res) => {
  const employeeId = req.header("x-employee-id");
  const orgId =
    req.header("x-org-id") ||
    req.header("x_org_id") ||
    req.header("org-id");

  if (!employeeId || !orgId) {
    return res.status(400).json({
      success: false,
      message: "Employee ID or Org ID missing",
    });
  }

  try {
    const hasSubordinates =
      await subordinateService.checkSubordinates(employeeId, orgId);

    res.json({ success: true, hasSubordinates });
  } catch (err) {
    console.error("Error fetching subordinates:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = { getSubordinateStatus };
