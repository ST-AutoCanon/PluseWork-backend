const pool = require("../config");
const {
  getLastMonthTotalSalaryQuery,
} = require("../constants/adminPayrollQueries");

const getLastMonthTotalSalary = async (orgId) => {
  try {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const formattedMonth = lastMonth
      .toLocaleString("en-US", { month: "short" })
      .toLowerCase(); // e.g., "sep"
    const formattedYear = lastMonth.getFullYear();

    // Table pattern with orgId (e.g., salary_101_sep_2025)
    const searchPattern = `salary_${orgId}_${formattedMonth}_${formattedYear}`;

    // Check for matching tables
    const [tables] = await pool.query(`SHOW TABLES LIKE ?`, [searchPattern]);

    if (tables.length === 0) {
      return null; // ✅ return null instead of throwing error
    }

    // Use the found table
    const tableName = Object.values(tables[0])[0];

    // Fetch total salary from that table
    const [result] = await pool.query(getLastMonthTotalSalaryQuery(tableName));

    return result[0]?.total_salary || 0;
  } catch (error) {
    console.error("Error fetching last month's salary:", error);
    throw error;
  }
};

module.exports = {
  getLastMonthTotalSalary,
};
