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
} = require("../handlers/assignCompensationHandler"); // Adjust path if needed

const router = express.Router();

// Check if an employee has an existing assignment
router.post("/check-assignment", checkEmployeeAssignmentHandler);

// Assign a compensation plan to an employee or department
router.post("/assign", assignCompensationHandler);

// Get all assigned compensation details
router.get("/assigned", getAssignedCompensationDetailsHandler);

// Add bonus to a single employee
router.post("/add-bonus", addEmployeeBonusHandler);

// Add bonus to multiple employees (bulk)
router.post("/add-bonus-bulk", addEmployeeBonusBulkHandler);

// Get all employee bonus details
router.get("/bonus-list", getEmployeeBonusDetailsHandler);

// Add advance to an employee
router.post("/advance", addEmployeeAdvanceHandler);

// Get all employee advance details
router.get("/advance-details", getEmployeeAdvanceDetailsHandler);

// Get all employee extra hours details
router.get("/employee-extra-hours", fetchEmployeeExtraHours);

// Add overtime details in bulk
router.post("/overtime-bulk", handleAddOvertimeDetailsBulk);

// Approve a single overtime row
router.post("/overtime/approve", handleApproveOvertimeRow);

// Reject a single overtime row
router.post("/overtime/reject", handleRejectOvertimeRow);

// Get all overtime details
router.get("/overtime-status-summary", getOvertimeDetailsHandler);

// Get LOP details for current period
router.get("/lop-details", getEmployeeLopHandler);

// Log registered routes
router.stack.forEach((r) => {
  if (r.route) {
  }
});

module.exports = router;
