const {
  calculateSalaryAttendanceDeductions,
} = require("../services/salaryAttendanceDeductionService");

async function calculateSalaryAttendanceDeductionsHandler(req, res) {
  const orgId = req.headers["x-org-id"];
  if (!orgId) {
    return res.status(400).json({ success: false, error: "x-org-id header is required." });
  }

  const { month, year, employees } = req.body || {};
  if (!month || !year || !Array.isArray(employees)) {
    return res.status(400).json({
      success: false,
      error: "month, year, and employees are required.",
    });
  }
  const monthNumber = Number(month);
  const yearNumber = Number(year);
  if (
    !Number.isInteger(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12 ||
    !Number.isInteger(yearNumber) ||
    yearNumber < 2000 ||
    yearNumber > 2200
  ) {
    return res.status(400).json({
      success: false,
      error: "month must be 1-12 and year must be a valid four-digit year.",
    });
  }

  try {
    const data = await calculateSalaryAttendanceDeductions({
      orgId,
      month: monthNumber,
      year: yearNumber,
      employees,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("[calculateSalaryAttendanceDeductions]", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to calculate attendance deductions.",
    });
  }
}

module.exports = { calculateSalaryAttendanceDeductionsHandler };
