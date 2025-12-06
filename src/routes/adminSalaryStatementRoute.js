const express = require("express");
const router = express.Router();
const {
  fetchSalaryStatement,
  fetchEmployeeBankDetails,
} = require("../handlers/adminSalaryStatementHandler");

router.get("/salary-statement/:month/:year", fetchSalaryStatement);

router.get("/employee-bank-details/:employeeId", fetchEmployeeBankDetails);

module.exports = router;
