const express = require('express');
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
  getWorkingDaysHandler 
} = require('../handlers/assignCompensationHandler'); // Adjust path if needed

const router = express.Router();

// Log imported handlers
console.log('checkEmployeeAssignmentHandler:', typeof checkEmployeeAssignmentHandler);
console.log('assignCompensationHandler:', typeof assignCompensationHandler);

// Check if an employee has an existing assignment
router.post('/check-assignment', checkEmployeeAssignmentHandler);

// Assign a compensation plan to an employee or department
router.post('/assign', assignCompensationHandler);

// Get all assigned compensation details
router.get('/assigned', getAssignedCompensationDetailsHandler);

// Add bonus to a single employee
router.post('/add-bonus', addEmployeeBonusHandler);

// Add bonus to multiple employees (bulk)
router.post('/add-bonus-bulk', addEmployeeBonusBulkHandler);

// Get all employee bonus details
router.get('/bonus-list', getEmployeeBonusDetailsHandler);

// Add advance to an employee
router.post('/advance', addEmployeeAdvanceHandler);

// Get all employee advance details
router.get('/advance-details', getEmployeeAdvanceDetailsHandler);

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
      cutoff_date: rows[0].cutoff_date || 25, // Default to 25 if null
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

router.get("/working-days", getWorkingDaysHandler);


// Log registered routes
router.stack.forEach((r) => {
  if (r.route) {
    console.log(`Router registered: ${Object.keys(r.route.methods)} ${r.route.path}`);
  }
});

module.exports = router;