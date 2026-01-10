

const { getTenantPool } = require("../db/tenantPoolManager");
const { workHourSummaryQuery } = require("../constants/attendanceQueries");


const getWorkHourSummary = async (employeeId) => {
  try {
    // Get the tenant-specific pool (adjust 'tenant_1' if needed, or make it dynamic later)
    const tenantPool = await getTenantPool("tenant_1");

    const [rows] = await tenantPool.execute(workHourSummaryQuery, [
      employeeId,
      employeeId,
      employeeId,
    ]);

    return rows;
  } catch (error) {
    console.error("❌ Database error in getWorkHourSummary:", error);
    throw error; // Let the controller handle the response
  }
};

module.exports = {
  getWorkHourSummary,
};