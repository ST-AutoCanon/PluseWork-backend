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
} = require("../handlers/assignCompensationHandler");

const router = express.Router();

router.post("/check-assignment", checkEmployeeAssignmentHandler);

router.post("/assign", assignCompensationHandler);

router.get("/assigned", getAssignedCompensationDetailsHandler);

router.post("/add-bonus", addEmployeeBonusHandler);

router.post("/add-bonus-bulk", addEmployeeBonusBulkHandler);

router.get("/bonus-list", getEmployeeBonusDetailsHandler);

router.post("/advance", addEmployeeAdvanceHandler);

router.get("/advance-details", getEmployeeAdvanceDetailsHandler);

router.get("/employee-extra-hours", fetchEmployeeExtraHours);

router.post("/overtime-bulk", handleAddOvertimeDetailsBulk);

router.post("/overtime/approve", handleApproveOvertimeRow);

router.post("/overtime/reject", handleRejectOvertimeRow);

router.get("/overtime-status-summary", getOvertimeDetailsHandler);

router.get("/lop-details", getEmployeeLopHandler);

router.stack.forEach((r) => {
  if (r.route) {
  }
});

module.exports = router;
