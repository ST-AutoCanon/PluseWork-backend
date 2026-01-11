const express = require("express");
const router = express.Router();
const {
  getSalarySlipHandler,
  handleGetEmployeeBankDetails,
  fetchEmployeeDetails,
} = require("../handlers/payrollHandler");

// Employee payslip (uses query params)
router.get("/salary-slip", getSalarySlipHandler);

// Employee personal details
router.get("/employee-details/:employee_id", fetchEmployeeDetails);

// Bank details
router.get("/bank-details/:employee_id", handleGetEmployeeBankDetails);

module.exports = router;