const express = require("express");
const {
  calculateSalaryAttendanceDeductionsHandler,
  calculateSalaryWorkedDaysHandler,
  getApprovedLopSummaryHandler,
} = require("../handlers/salaryAttendanceDeductionHandler");

const router = express.Router();

router.post("/calculate", calculateSalaryAttendanceDeductionsHandler);
router.post("/worked-days", calculateSalaryWorkedDaysHandler);
router.post("/approved-lop-summary", getApprovedLopSummaryHandler);

module.exports = router;
