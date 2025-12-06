const express = require("express");
const router = express.Router();
const {
  handleGetCurrentMonthLOP,
  handleGetDeferredLOP,
  handleGetNextMonthLOP,
} = require("../handlers/lossofPayCalculationHandler");

router.get("/current-month-lop", handleGetCurrentMonthLOP);

router.get("/deferred-lop", handleGetDeferredLOP);

router.get("/next-month-lop", handleGetNextMonthLOP);

module.exports = router;
