const express = require("express");
const router = express.Router();
const {
  getSalarySlipHandler,
  handleGetEmployeeBankDetails,
  fetchEmployeeDetails,
  getApprovedPayrollLeaveCountHandler,
} = require("../handlers/payrollHandler");

router.get("/salary-slip", getSalarySlipHandler);

router.get("/employee-details/:employee_id", fetchEmployeeDetails);

router.get("/bank-details/:employee_id", handleGetEmployeeBankDetails);

router.get(
  "/approved-payroll-leave-count/:employee_id",
  getApprovedPayrollLeaveCountHandler
);

module.exports = router;
