
// const db = require("../config");
// const {
//   checkIfTableExists,
//   createTableQuery,
//   insertSalaryData,  // Updated to UPSERT
//   getApprovedIdsQuery,
// } = require("../constants/salaryDetailsQueries");
// const moment = require("moment");

// const tableExists = async (tableName) => {
//   const [result] = await db.query(checkIfTableExists(tableName));
//   return result[0].count > 0;
// };

// const getApprovedEmployeeIds = async () => {
//   const tableName = generateTableName();
//   if (!(await tableExists(tableName))) return [];

//   const [rows] = await db.query(getApprovedIdsQuery(tableName));
//   return rows.map((r) => r.employee_id);
// };

// // New: Fetch all rows for a specific month/year
// const getMonthlySalaryData = async (month, year) => {
//   const tableName = `salary_sts_${month.toLowerCase()}_${year}`;
//   if (!(await tableExists(tableName))) return [];

//   const [rows] = await db.query(`SELECT * FROM \`${tableName}\``);
//   return rows;
// };

// const createTableIfNotExists = async (tableName) => {
//   const query = createTableQuery(tableName);
//   try {
//     await db.query(query);
//     return true;
//   } catch (error) {
//     console.error("Error creating table:", error);
//     throw new Error("Failed to create table.");
//   }
// };

// const ensureColumns = async (tableName) => {
//   const OTHER_COLUMNS =
//     require("../constants/salaryDetailsQueries").SALARY_COLUMNS.slice(1);
//   const ALL_COLUMNS = ["employee_id", ...OTHER_COLUMNS];
//   const MONETARY_COLUMNS =
//     require("../constants/salaryDetailsQueries").MONETARY_COLUMNS;

//   for (const col of ALL_COLUMNS) {
//     try {
//       const [rows] = await db.query(
//         `SHOW COLUMNS FROM \`${tableName}\` LIKE '${col.replace(/`/g, "\\`")}';`
//       );
//       if (rows.length === 0) {
//         let type;
//         if (col === "employee_id") {
//           type = "VARCHAR(50) UNIQUE NOT NULL";
//         } else if (col === "status") {
//           type = "VARCHAR(20) DEFAULT 'Pending'";
//         } else {
//           type = MONETARY_COLUMNS.includes(col)
//             ? "DECIMAL(12,2) DEFAULT NULL"
//             : "VARCHAR(255) DEFAULT NULL";
//         }

//         await db.query(
//           `ALTER TABLE \`${tableName}\` ADD COLUMN \`${col}\` ${type};`
//         );
//       }
//     } catch (error) {
//       console.error(`Error ensuring column ${col}:`, error);
//       if (col === "employee_id") throw error;
//     }
//   }
// };

// const generateTableName = () => {
//   const now = moment();
//   const month = now.format("MMM").toLowerCase();
//   const year = now.format("YYYY");
//   return `salary_sts_${month}_${year}`;
// };

// // Updated: Accept month/year, use for tableName (override current date)
// const saveSalaryDetails = async (salaryData, month, year) => {
//   let tableName;
//   if (month && year) {
//     tableName = `salary_sts_${month.toLowerCase()}_${year}`;
//   } else {
//     tableName = generateTableName();
//   }

//   if (!(await tableExists(tableName))) {
//     await createTableIfNotExists(tableName);
//   }

//   await ensureColumns(tableName);
  
//   // REMOVED: await deleteExistingSalaryData(tableName);  // No more wiping!

//   const affectedRows = await insertSalaryRecords(tableName, salaryData);

//   return { success: true, tableName, rowsAffected: affectedRows };
// };

// // Updated: Capture affectedRows from query and return it
// const insertSalaryRecords = async (tableName, rows) => {
//   try {
//     if (rows.length === 0) {
//       console.warn("No rows to insert.");
//       return 0;
//     }

//     const { query, values } = insertSalaryData(tableName, rows);
//     if (query) {
//       const [result] = await db.query(query, values);  // result.affectedRows = inserts + updates
//       console.log(`Affected rows: ${result.affectedRows}`);  // For logging
//       return result.affectedRows || 0;
//     }
//     return 0;
//   } catch (error) {
//     console.error("Error inserting data:", error);
//     throw error;
//   }
// };

// module.exports = {
//   saveSalaryDetails,
//   generateTableName,
//   tableExists,
//   createTableIfNotExists,
//   insertSalaryRecords,
//   ensureColumns,
//   getApprovedEmployeeIds,
//   getMonthlySalaryData,  // New
// };

const db = require("../config");
const {
  checkIfTableExists,
  createTableQuery,
  insertSalaryData,
  getApprovedIdsQuery,
} = require("../constants/salaryDetailsQueries");
const moment = require("moment");

const tableExists = async (tableName) => {
  const [result] = await db.query(checkIfTableExists(tableName));
  return result[0].count > 0;
};

// ... rest unchanged ...

const generateTableName = (orgId, month = null, year = null) => {
  const now = moment();
  const m = (month || now.format("MMM")).toLowerCase();
  const y = year || now.format("YYYY");
  const safeOrgId = String(orgId).replace(/[^a-zA-Z0-9_]/g, "_");
  return `${safeOrgId}_${m}_${y}`;
};

// ... rest of file unchanged (no throw) ...

const getApprovedEmployeeIds = async (orgId) => {
  const tableName = generateTableName(orgId);
  if (!(await tableExists(tableName))) return [];

  const [rows] = await db.query(getApprovedIdsQuery(tableName));
  return rows.map((r) => r.employee_id);
};

const getMonthlySalaryData = async (month, year, orgId) => {
  const tableName = generateTableName(orgId, month, year);
  if (!(await tableExists(tableName))) return [];

  const [rows] = await db.query(`SELECT * FROM \`${tableName}\``);
  return rows;
};

const createTableIfNotExists = async (tableName) => {
  const query = createTableQuery(tableName);
  try {
    await db.query(query);
    return true;
  } catch (error) {
    console.error("Error creating table:", error);
    throw new Error("Failed to create table.");
  }
};

const ensureColumns = async (tableName) => {
  const OTHER_COLUMNS =
    require("../constants/salaryDetailsQueries").SALARY_COLUMNS.slice(1);
  const ALL_COLUMNS = ["employee_id", ...OTHER_COLUMNS];
  const MONETARY_COLUMNS =
    require("../constants/salaryDetailsQueries").MONETARY_COLUMNS;

  for (const col of ALL_COLUMNS) {
    try {
      const [rows] = await db.query(
        `SHOW COLUMNS FROM \`${tableName}\` LIKE '${col.replace(/`/g, "\\`")}';`
      );
      if (rows.length === 0) {
        let type;
        if (col === "employee_id") {
          type = "VARCHAR(50) UNIQUE NOT NULL";
        } else if (col === "status") {
          type = "VARCHAR(20) DEFAULT 'Pending'";
        } else {
          type = MONETARY_COLUMNS.includes(col)
            ? "DECIMAL(12,2) DEFAULT NULL"
            : "VARCHAR(255) DEFAULT NULL";
        }

        await db.query(
          `ALTER TABLE \`${tableName}\` ADD COLUMN \`${col}\` ${type};`
        );
      }
    } catch (error) {
      console.error(`Error ensuring column ${col}:`, error);
      if (col === "employee_id") throw error;
    }
  }
};

const saveSalaryDetails = async (salaryData, month, year, orgId) => {
  const tableName = generateTableName(orgId, month, year);

  if (!(await tableExists(tableName))) {
    await createTableIfNotExists(tableName);
  }

  await ensureColumns(tableName);
  
  const affectedRows = await insertSalaryRecords(tableName, salaryData);

  return { success: true, tableName, rowsAffected: affectedRows };
};

const insertSalaryRecords = async (tableName, rows) => {
  try {
    if (rows.length === 0) {
      console.warn("No rows to insert.");
      return 0;
    }

    const { query, values } = insertSalaryData(tableName, rows);
    if (query) {
      const [result] = await db.query(query, values);
      console.log(`Affected rows: ${result.affectedRows}`);
      return result.affectedRows || 0;
    }
    return 0;
  } catch (error) {
    console.error("Error inserting data:", error);
    throw error;
  }
};

module.exports = {
  saveSalaryDetails,
  generateTableName,
  tableExists,
  createTableIfNotExists,
  insertSalaryRecords,
  ensureColumns,
  getApprovedEmployeeIds,
  getMonthlySalaryData,
};