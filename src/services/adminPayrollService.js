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
      .toLowerCase();
    const formattedYear = lastMonth.getFullYear();

    const searchPattern = `salary_${orgId}_${formattedMonth}_${formattedYear}`;

    const [tables] = await pool.query(`SHOW TABLES LIKE ?`, [searchPattern]);

    if (tables.length === 0) {
      return null;
    }

    const tableName = Object.values(tables[0])[0];

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
