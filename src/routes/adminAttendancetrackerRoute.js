const express = require("express");
const router = express.Router();
const {
  getMissingPunchInEmployeesHandler,
  getEmployeesWithPunchInNotPunchedOutHandler,
  getEmployeesWorkedLessThan8HoursHandler,
  getEmployeesWorked8To10HoursHandler,
  getApprovedLeavesCurrentMonthHandler,
} = require("../handlers/adminAttendancetrackerHandler");

router.get("/missing-punch-in", getMissingPunchInEmployeesHandler);

router.get(
  "/punch-in-not-punched-out",
  getEmployeesWithPunchInNotPunchedOutHandler
);

router.get(
  "/worked-less-than-8-hours",
  getEmployeesWorkedLessThan8HoursHandler
);

router.get("/worked-8-to-10-hours", getEmployeesWorked8To10HoursHandler);

router.get(
  "/approved-leaves-current-month",
  getApprovedLeavesCurrentMonthHandler
);

module.exports = router;
