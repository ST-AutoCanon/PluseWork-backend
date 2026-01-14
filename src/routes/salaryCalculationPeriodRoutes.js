const express = require("express");
const router = express.Router();
const {
  addPeriodHandler,
  getAllPeriodsHandler,
  updatePeriodHandler,
} = require("../handlers/salaryCalculationPeriodHandler");

router.post("/addSalaryCalculationperiod", addPeriodHandler);

router.get("/salaryCalculationperiods", getAllPeriodsHandler);

router.put("/updateSalaryCalculationperiod/:id", updatePeriodHandler);

module.exports = router;
