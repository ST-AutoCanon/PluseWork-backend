const express = require("express");
const router = express.Router();
const {
  fetchSalaryStatement,
  fetchEmployeeBankDetails,
  updatePayslipStatus,
} = require("../handlers/adminSalaryStatementHandler");

router.get("/salary-statement/:month/:year", fetchSalaryStatement);
router.get("/employee-bank-details/:employeeId", fetchEmployeeBankDetails);

// Update payslip_generated
router.post(
  "/salary-statement/update-payslip/:month/:year/:employeeId",
  updatePayslipStatus
);

module.exports = router;
