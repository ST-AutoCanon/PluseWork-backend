const db = require("../config");
const payrollQueries = require("../constants/payrollQueries");

const findSalaryTable = async (month, year) => {
  try {
    const monthName = new Date(year, month - 1)
      .toLocaleString("default", { month: "short" })
      .toLowerCase();

    const query = `SHOW TABLES`;
    const [rows] = await db.execute(query);

    const matchedTable = rows.find((row) => {
      const tableName = Object.values(row)[0].toLowerCase();
      return tableName.includes(monthName);
    });

    if (!matchedTable) {
      return null;
    }

    const tableName = Object.values(matchedTable)[0];
    return tableName;
  } catch (error) {
    console.error("Error finding salary table:", error);
    return null;
  }
};

const getSalarySlip = async (employee_id, month, year) => {
  try {
    const tableName = await findSalaryTable(month, year);
    if (!tableName) {
      return null;
    }

    const queryAll = `SELECT * FROM ${tableName}`;
    const [allRows] = await db.execute(queryAll);

    const queryEmployee = `SELECT * FROM ${tableName} WHERE employee_id = ?`;
    const [rows] = await db.execute(queryEmployee, [employee_id]);

    if (rows.length === 0) {
      return null;
    }

    return rows[0];
  } catch (error) {
    console.error("Database query failed:", error);
    throw error;
  }
};

const getEmployeeBankDetails = async (employee_id) => {
  try {
    const [rows] = await db.execute(
      payrollQueries.GETEMPLOYEEBANKDETAILSQUERY,
      [employee_id]
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0];
  } catch (error) {
    console.error("Database query failed:", error);
    throw error;
  }
};
const getEmployeeDetails = async (employee_id) => {
  try {
    const [rows] = await db.execute(payrollQueries.GET_EMPLOYEE_DETAILS_QUERY, [
      employee_id,
    ]);

    if (rows.length === 0) {
      return null;
    }

    return rows[0];
  } catch (error) {
    console.error("Database query failed:", error);
    throw error;
  }
};

module.exports = { getSalarySlip, getEmployeeBankDetails, getEmployeeDetails };
