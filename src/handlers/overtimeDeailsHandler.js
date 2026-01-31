const overtimeService = require("./../services/overtimeDetailsService");

const bulkUpdateOvertime = async (req, res) => {
  try {
    const { data } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Invalid input: data must be a non-empty array",
        });
    }
    const updateResults = await overtimeService.upsertOvertimeRecords(
      data,
      req.employeeId
    );
    const insertedCount = updateResults.filter((r) => r.insertId > 0).length;
    const updatedCount = updateResults.filter((r) => r.affectedRows > 0 && !(r.insertId > 0)).length;
    res.status(200).json({
      success: true,
      message: `Successfully inserted ${insertedCount} and updated ${updatedCount} overtime record(s)`,
      data: { insertedCount, updatedCount },
    });
  } catch (error) {
    console.error("Error in bulkUpdateOvertime:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Internal server error",
      });
  }
};

const fetchEmployeeExtraHours = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({
          success: false,
          error: "startDate and endDate query parameters are required",
        });
    }
    const overtimeData = await overtimeService.getEmployeeExtraHours(
      startDate,
      endDate,
      req.employeeId
    );
    res.status(200).json({ success: true, data: overtimeData });
  } catch (error) {
    console.error("Error in fetchEmployeeExtraHours:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Internal server error",
      });
  }
};

const upsertOvertimeRecords = async (req, res) => {
  try {
    const { data } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Invalid input: data must be a non-empty array",
        });
    }
    const upsertResults = await overtimeService.upsertOvertimeRecords(
      data,
      req.employeeId
    );
    const insertedCount = upsertResults.filter(
      (result) => result.insertId > 0
    ).length;
    const updatedCount = upsertResults.filter(
      (result) => result.affectedRows > 0 && result.insertId === 0
    ).length;
    res.status(200).json({
      success: true,
      message: `Successfully inserted ${insertedCount} and updated ${updatedCount} overtime record(s)`,
      data: { insertedCount, updatedCount },
    });
  } catch (error) {
    console.error("Error in upsertOvertimeRecords:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Internal server error",
      });
  }
};

module.exports = {
  bulkUpdateOvertime,
  fetchEmployeeExtraHours,
  upsertOvertimeRecords,
};
