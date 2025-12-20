// Express routes for salary_calculation_period
// Mounts under /api

const express = require('express');
const router = express.Router();
const {
  addPeriodHandler,
  getAllPeriodsHandler,
  updatePeriodHandler,
} = require('../handlers/salaryCalculationPeriodHandler');

// POST /api/addSalaryCalculationperiod - Add new period
router.post('/addSalaryCalculationperiod', addPeriodHandler);

// GET /api/salaryCalculationperiods - List all periods
router.get('/salaryCalculationperiods', getAllPeriodsHandler);

// PUT /api/updateSalaryCalculationperiod/:id - Update period by ID
router.put('/updateSalaryCalculationperiod/:id', updatePeriodHandler);

module.exports = router;