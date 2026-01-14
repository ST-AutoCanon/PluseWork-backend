const { getTenantPool } = require("../db/tenantPoolManager");
const { workHourSummaryQuery } = require("../constants/attendanceQueries");

const getWorkHourSummary = async (employeeId) => {
  try {
    const tenantPool = await getTenantPool("tenant_1");

    const [rows] = await tenantPool.execute(workHourSummaryQuery, [
      employeeId,
      employeeId,
      employeeId,
    ]);

    return rows;
  } catch (error) {
    console.error("❌ Database error in getWorkHourSummary:", error);
    throw error;
  }
};

module.exports = {
  getWorkHourSummary,
};
