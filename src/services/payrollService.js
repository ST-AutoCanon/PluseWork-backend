const db = require("../config"); // Ensure correct DB connection
const payrollQueries = require("../constants/payrollQueries");

// Function to find the correct salary table based on month name
const findSalaryTable = async (month, year) => {
  try {
    const monthName = new Date(year, month - 1)
      .toLocaleString("default", { month: "short" })
      .toLowerCase(); // e.g., "mar" for March

    const query = `SHOW TABLES`;
    const [rows] = await db.execute(query); // Get all tables

    // Find the first table containing the month abbreviation (case insensitive)
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

// Function to get salary slip from the correct table
const getSalarySlip = async (employee_id, month, year) => {
  try {
    const tableName = await findSalaryTable(month, year);
    if (!tableName) {
      return null;
    }

    // Fetch all data to check if the employee exists
    const queryAll = `SELECT * FROM ${tableName}`;
    const [allRows] = await db.execute(queryAll);

    // Fetch salary data for the specific employee
    const queryEmployee = `SELECT * FROM ${tableName} WHERE employee_id = ?`;
    const [rows] = await db.execute(queryEmployee, [employee_id]);

    if (rows.length === 0) {
      return null;
    }

    return rows[0]; // Return first row
  } catch (error) {
    console.error("Database query failed:", error);
    throw error;
  }
};

const getEmployeeBankDetails = async (employee_id) => {
  try {
    // Execute the query to fetch bank details
    const [rows] = await db.execute(
      payrollQueries.GETEMPLOYEEBANKDETAILSQUERY,
      [employee_id]
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0]; // Return the first row (assuming one bank account per employee)
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
