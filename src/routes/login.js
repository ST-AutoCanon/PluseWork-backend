const express = require("express");
const router = express.Router();
const LoginHandler = require("../handlers/loginHandler");
router.post("/login", LoginHandler.login);
router.post("/logout", LoginHandler.logout);
router.get("/salary-ranges", LoginHandler.getSalaryRanges);
router.get("/attendance-status", LoginHandler.getAttendanceStatusCount);
router.get("/login-data-count", LoginHandler.getEmployeeLoginDataCount);
router.get("/employee-count", LoginHandler.getEmployeeCountByDepartment);
router.get(
  "/employee-count-by-department",
  LoginHandler.getEmployeeCountByDepartment
);
router.get("/total-payroll-data", LoginHandler.getEmployeePayrollData);

module.exports = router;
