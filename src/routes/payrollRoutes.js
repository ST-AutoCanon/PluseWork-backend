const express = require("express");
const router = express.Router();
const { getSalarySlipHandler } = require("../handlers/payrollHandler");
const {
  handleGetEmployeeBankDetails,
  fetchEmployeeDetails,
} = require("../handlers/payrollHandler");

router.get("/salary-slip", getSalarySlipHandler);
router.get("/bank-details/:employee_id", handleGetEmployeeBankDetails);
router.get("/employee-details/:employee_id", fetchEmployeeDetails);

module.exports = router;
