// src/controllers/overtimeController.js
const overtimeService = require('./../services/overtimeDetailsService');

// Older function (bulkUpdateOvertime) - keep if needed, or remove and update routes
const bulkUpdateOvertime = async (req, res) => {
  try {
    const { data } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid input: data must be a non-empty array' });
    }
    const updateResults = await overtimeService.updateOvertimeRecords(data, req.employeeId);
    const updatedCount = updateResults.filter(result => result.affectedRows > 0).length;
    res.status(200).json({
      success: true,
      message: `Successfully updated ${updatedCount} overtime record(s)`,
      data: { updatedCount },
    });
  } catch (error) {
    console.error('Error in bulkUpdateOvertime:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

// Fetch function (unchanged)
const fetchEmployeeExtraHours = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'startDate and endDate query parameters are required' });
    }
    const overtimeData = await overtimeService.getEmployeeExtraHours(startDate, endDate, req.employeeId);
    res.status(200).json({ success: true, data: overtimeData });
  } catch (error) {
    console.error('Error in fetchEmployeeExtraHours:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

// New upsert function (for insert/update on approve/reject)
const upsertOvertimeRecords = async (req, res) => {
  try {
    const { data } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid input: data must be a non-empty array' });
    }
    const upsertResults = await overtimeService.upsertOvertimeRecords(data, req.employeeId);
    const insertedCount = upsertResults.filter(result => result.insertId > 0).length;
    const updatedCount = upsertResults.filter(result => result.affectedRows > 0 && result.insertId === 0).length;
    res.status(200).json({
      success: true,
      message: `Successfully inserted ${insertedCount} and updated ${updatedCount} overtime record(s)`,
      data: { insertedCount, updatedCount },
    });
  } catch (error) {
    console.error('Error in upsertOvertimeRecords:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

module.exports = {
  bulkUpdateOvertime,      // Export the older one if your routes use it
  fetchEmployeeExtraHours,
  upsertOvertimeRecords,   // Export the new one
};