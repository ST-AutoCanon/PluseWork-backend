const express = require("express");
const {
  calculateSalaryAttendanceDeductionsHandler,
} = require("../handlers/salaryAttendanceDeductionHandler");

const router = express.Router();

router.post("/calculate", calculateSalaryAttendanceDeductionsHandler);

module.exports = router;
