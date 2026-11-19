const {
  calculateSalaryAttendanceDeductions,
} = require("../services/salaryAttendanceDeductionService");
const {
  calculateSalaryWorkedDays,
} = require("../services/salaryWorkedDaysService");

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

async function calculateSalaryWorkedDaysHandler(req, res) {
  const orgId = req.headers["x-org-id"];
  if (!orgId) {
    return res.status(400).json({ success: false, error: "x-org-id header is required." });
  }

  const { month, year, asOfDate, employees } = req.body || {};
  const monthNumber = Number(month);
  const yearNumber = Number(year);
  const parsedAsOfDate =
    typeof asOfDate === "string" ? new Date(`${asOfDate}T00:00:00Z`) : null;
  const validAsOfDate =
    asOfDate === undefined ||
    (typeof asOfDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(asOfDate) &&
      !Number.isNaN(parsedAsOfDate.getTime()) &&
      parsedAsOfDate.toISOString().slice(0, 10) === asOfDate &&
      Number(asOfDate.slice(5, 7)) === monthNumber &&
      Number(asOfDate.slice(0, 4)) === yearNumber);
  if (
    !Number.isInteger(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12 ||
    !Number.isInteger(yearNumber) ||
    yearNumber < 2000 ||
    yearNumber > 2200 ||
    !Array.isArray(employees) ||
    !validAsOfDate
  ) {
    return res.status(400).json({
      success: false,
      error: "A valid month, year, and employees array are required.",
    });
  }

  try {
    const data = await calculateSalaryWorkedDays({
      orgId,
      month: monthNumber,
      year: yearNumber,
      asOfDate,
      employees,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("[calculateSalaryWorkedDays]", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to calculate worked days.",
    });
  }
}

module.exports = {
  calculateSalaryAttendanceDeductionsHandler,
  calculateSalaryWorkedDaysHandler,
};
