const express = require("express");
const {
  checkEmployeeAssignmentHandler,
  assignCompensationHandler,
  getAssignedCompensationDetailsHandler,
  addEmployeeBonusHandler,
  addEmployeeBonusBulkHandler,
  getEmployeeBonusDetailsHandler,
  addEmployeeAdvanceHandler,
  getEmployeeAdvanceDetailsHandler,
  fetchEmployeeExtraHours,
  handleAddOvertimeDetailsBulk,
  handleApproveOvertimeRow,
  handleRejectOvertimeRow,
  getOvertimeDetailsHandler,

  getEmployeeLopHandler,
  getWorkingDaysHandler,
} = require("../handlers/assignCompensationHandler");

const router = express.Router();

console.log(
  "checkEmployeeAssignmentHandler:",
  typeof checkEmployeeAssignmentHandler
);
console.log("assignCompensationHandler:", typeof assignCompensationHandler);

router.post("/check-assignment", checkEmployeeAssignmentHandler);

router.post("/assign", assignCompensationHandler);

router.get("/assigned", getAssignedCompensationDetailsHandler);

router.post("/add-bonus", addEmployeeBonusHandler);

router.post("/add-bonus-bulk", addEmployeeBonusBulkHandler);

router.get("/bonus-list", getEmployeeBonusDetailsHandler);

router.post("/advance", addEmployeeAdvanceHandler);

router.get("/advance-details", getEmployeeAdvanceDetailsHandler);

router.get("/salary-cutoff", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT cutoff_date FROM salary_calculation_period WHERE id = 1"
    );
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Cutoff date not found",
      });
    }
    res.status(200).json({
      success: true,
      cutoff_date: rows[0].cutoff_date || 25,
    });
  } catch (error) {
    console.error("Error fetching salary cutoff:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch cutoff date",
      details: error.message,
    });
  }
});
router.get("/employee-extra-hours", fetchEmployeeExtraHours);

router.post("/overtime-bulk", handleAddOvertimeDetailsBulk);

router.post("/overtime/approve", handleApproveOvertimeRow);

router.post("/overtime/reject", handleRejectOvertimeRow);

router.get("/overtime-status-summary", getOvertimeDetailsHandler);

router.get("/lop-details", getEmployeeLopHandler);

router.get("/working-days", getWorkingDaysHandler);

router.stack.forEach((r) => {
  if (r.route) {
    console.log(
      `Router registered: ${Object.keys(r.route.methods)} ${r.route.path}`
    );
  }
});

module.exports = router;
