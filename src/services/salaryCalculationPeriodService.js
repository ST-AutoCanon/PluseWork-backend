// Business logic for salary_calculation_period operations
// Handles validation, database interactions using queries

const db = require('../config'); // Adjust path to your DB connection pool
const queries = require('../constants/salaryCalculationPeriodQueries');

class SalaryCalculationPeriodService {
  // Add or update period (since id defaults to 1, handles upsert)
  static async addPeriod(cutoffDate) {
    try {
      // Validation
      const cutoffNum = parseInt(cutoffDate);
      if (isNaN(cutoffNum) || cutoffNum < 1 || cutoffNum > 31) {
        throw new Error('Cutoff date must be an integer between 1 and 31');
      }

      const [result] = await db.execute(queries.ADD_SALARY_PERIOD, [cutoffNum]);
      return {
        success: true,
        data: { id: result.insertId || 1, cutoff_date: cutoffNum },
        message: result.insertId ? 'Period added successfully' : 'Period updated successfully',
      };
    } catch (error) {
      throw new Error(`Service error: ${error.message}`);
    }
  }

  // Get all periods
  static async getAllPeriods() {
    try {
      const [rows] = await db.execute(queries.GET_ALL_SALARY_PERIODS);
      return {
        success: true,
        data: rows,
        message: 'Periods fetched successfully',
      };
    } catch (error) {
      throw new Error(`Service error: ${error.message}`);
    }
  }

  // Update period by ID
  static async updatePeriod(id, cutoffDate) {
    try {
      // Validation
      const cutoffNum = parseInt(cutoffDate);
      if (isNaN(cutoffNum) || cutoffNum < 1 || cutoffNum > 31) {
        throw new Error('Cutoff date must be an integer between 1 and 31');
      }

      const [result] = await db.execute(queries.UPDATE_SALARY_PERIOD, [cutoffNum, id]);
      if (result.affectedRows === 0) {
        throw new Error('Period not found');
      }

      // Fetch updated record
      const [updatedRows] = await db.execute(queries.GET_SALARY_PERIOD_BY_ID, [id]);
      return {
        success: true,
        data: updatedRows[0],
        message: 'Period updated successfully',
      };
    } catch (error) {
      throw new Error(`Service error: ${error.message}`);
    }
  }
}

module.exports = SalaryCalculationPeriodService;