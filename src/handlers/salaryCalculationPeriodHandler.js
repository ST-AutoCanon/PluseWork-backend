// Express request handlers for salary_calculation_period endpoints
// Calls services and handles HTTP responses/errors

const SalaryCalculationPeriodService = require('../services/salaryCalculationPeriodService');

const addPeriodHandler = async (req, res, next) => {
  try {
    const { cutoff_date } = req.body;
    if (!cutoff_date) {
      return res.status(400).json({ success: false, error: 'Cutoff date is required' });
    }

    const result = await SalaryCalculationPeriodService.addPeriod(cutoff_date);
    res.status(201).json(result);
  } catch (error) {
    next(error); // Pass to Express error middleware
  }
};

const getAllPeriodsHandler = async (req, res, next) => {
  try {
    const result = await SalaryCalculationPeriodService.getAllPeriods();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const updatePeriodHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cutoff_date } = req.body;
    if (!cutoff_date) {
      return res.status(400).json({ success: false, error: 'Cutoff date is required' });
    }

    const result = await SalaryCalculationPeriodService.updatePeriod(id, cutoff_date);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addPeriodHandler,
  getAllPeriodsHandler,
  updatePeriodHandler,
};