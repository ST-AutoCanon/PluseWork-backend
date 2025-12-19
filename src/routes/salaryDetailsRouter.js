// Backend: routes/salaryDetailsRouter.js (Updated save handler to always ensure column)
const express = require("express");
const router = express.Router();
const pool = require("../config"); // Adjust path to your DB config
const {
  deleteExistingData,
  insertSalaryData,
} = require("../constants/salaryQueries");

// Helper to format column name
const formatColumnName = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "");
};

// Helper function to ensure payslip_generated column exists
const ensurePayslipColumn = async (tableName) => {
  try {
    // Check if column exists
    const [columns] = await pool.query(
      `SHOW COLUMNS FROM \`${tableName}\` LIKE 'payslip_generated'`
    );
    if (columns.length === 0) {
      // Add the column if it doesn't exist
      await pool.query(
        `ALTER TABLE \`${tableName}\` ADD COLUMN \`payslip_generated\` INT DEFAULT 0 NOT NULL`
      );
      console.log(`Added payslip_generated column to table: ${tableName}`);
    }
  } catch (error) {
    console.error("Error ensuring payslip column:", error);
    throw error;
  }
};

// POST /api/salary-details/save - Save or replace salary data for month/year
router.post("/save", async (req, res) => {
  try {
    const { salaryData, month, year } = req.body;
    if (!salaryData || !Array.isArray(salaryData) || salaryData.length === 0) {
      return res.status(400).json({ error: "No salary data provided" });
    }
    if (!month || !year) {
      return res.status(400).json({ error: "Month and year are required" });
    }

    const tableName = `salary_sts_${month}_${year}`;

    // Extract unique columns from data (ensure payslip_generated is included)
    const allColumns = new Set();
    salaryData.forEach((row) => {
      Object.keys(row).forEach((key) => allColumns.add(formatColumnName(key)));
    });
    if (!allColumns.has("payslip_generated")) {
      allColumns.add("payslip_generated");
    }
    const columns = Array.from(allColumns);

    // Ensure payslip_generated defaults to 0 for all rows
    const processedData = salaryData.map((row) => ({
      ...row,
      payslip_generated: row.payslip_generated ?? 0,
    }));

    // Create table if not exists (TEXT for most, INT for payslip_generated)
    const columnDefs = columns
      .map((col) =>
        col === "payslip_generated"
          ? `\`${col}\` INT DEFAULT 0 NOT NULL`
          : `\`${col}\` TEXT`
      )
      .join(", ");
    const createQuery = `CREATE TABLE IF NOT EXISTS \`${tableName}\` (${columnDefs})`;
    await pool.query(createQuery);
    console.log(`Table created/ensured: ${tableName}`);

    // Ensure the payslip column exists (in case table was created without it previously)
    await ensurePayslipColumn(tableName);

    // Delete existing data
    await pool.query(deleteExistingData(tableName));
    console.log(`Cleared existing data from: ${tableName}`);

    // Insert new data (handle formatted keys)
    let insertCount = 0;
    for (const row of processedData) {
      const formattedRow = {};
      Object.keys(row).forEach((key) => {
        formattedRow[formatColumnName(key)] = row[key];
      });
      // Filter out invalid rows (e.g., missing employee_id)
      if (!formattedRow.employee_id || !formattedRow.full_name) {
        console.warn(`Skipping invalid row for employee_id: ${formattedRow.employee_id}`);
        continue;
      }
      const { query, values } = insertSalaryData(tableName, formattedRow);
      await pool.query(query, values);
      insertCount++;
    }

    res.json({ 
      success: true, 
      tableName, 
      message: `${insertCount} rows inserted successfully` 
    });
  } catch (error) {
    console.error("Error saving salary data:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;