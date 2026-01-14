const express = require("express");
const router = express.Router();
const {
  getSalarySlipHandler,
  handleGetEmployeeBankDetails,
  fetchEmployeeDetails,
} = require("../handlers/payrollHandler");

router.get("/salary-slip", getSalarySlipHandler);

router.get("/employee-details/:employee_id", fetchEmployeeDetails);

router.get("/bank-details/:employee_id", handleGetEmployeeBankDetails);

module.exports = router;
