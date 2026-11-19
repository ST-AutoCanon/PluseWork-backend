const express = require("express");
const {
  calculateSalaryAttendanceDeductionsHandler,
  calculateSalaryWorkedDaysHandler,
} = require("../handlers/salaryAttendanceDeductionHandler");

const router = express.Router();

router.post("/calculate", calculateSalaryAttendanceDeductionsHandler);
router.post("/worked-days", calculateSalaryWorkedDaysHandler);

module.exports = router;
