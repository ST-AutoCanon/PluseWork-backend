const express = require("express");
const router = express.Router();
const {
  handleGetCurrentMonthLOP,
  handleGetDeferredLOP,
  handleGetNextMonthLOP,
} = require("../handlers/lossofPayCalculationHandler");

// Route to get LOP for current month's payroll
router.get("/current-month-lop", handleGetCurrentMonthLOP);

// Route to get deferred LOP for next month's payroll
router.get("/deferred-lop", handleGetDeferredLOP);

// Route to get LOP approved for next month
router.get("/next-month-lop", handleGetNextMonthLOP);

module.exports = router;
