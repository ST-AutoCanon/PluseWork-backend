const express = require("express");
const router = express.Router();
const { fetchLastMonthSalary } = require("../handlers/adminPayrollHandler");

router.get("/salary/last-month-total", fetchLastMonthSalary);

module.exports = router;
