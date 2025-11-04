const multer = require("multer");
const XLSX = require("xlsx");
const moment = require("moment");
const pool = require("../config.js");
const {
  checkIfTableExists,
  createTableQuery,
  deleteExistingData,
  insertSalaryData,
} = require("../constants/salaryQueries");

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const tableExists = async (tableName) => {
  const result = await pool.query(checkIfTableExists(tableName));
  return result[0].count > 0;
};

const createTableIfNotExists = async (tableName, columns) => {
  const query = createTableQuery(tableName, columns);
  try {
    await pool.query(query);
  } catch (error) {
    console.error("Error creating table:", error);
    throw new Error("Failed to create table.");
  }
};

const generateEmployeeId = () => {
  return `EMP${Math.floor(10000 + Math.random() * 90000)}`;
};

const formatColumnName = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "");
};

/**
 * Generate table name using orgId (from headers) and filename (month_year inside filename)
 * Final format: <orgId>_<month>_<year>
 *
 * @param {string} orgId - organization id from headers (required)
 * @param {string} fileName - filename (without extension), expected to contain month_year like "mar_2025"
 */
const generateTableName = (orgId, fileName) => {
  if (!orgId) {
    throw new Error(
      "❌ Missing orgId header. Provide orgId in request headers."
    );
  }

  // normalize orgId: lowercase, replace spaces with underscore, remove invalid chars
  const normalizedOrgId = String(orgId)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

  if (!normalizedOrgId) {
    throw new Error(
      "❌ Invalid orgId header. orgId must contain letters/numbers."
    );
  }

  const dateMatch = fileName.match(
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[_-](\d{4})/i
  );

  if (!dateMatch) {
    throw new Error(
      "❌ Filename must contain month and year (e.g., salary_mar_2025.xlsx or mar-2025)."
    );
  }

  const month = dateMatch[1].toLowerCase();
  const year = dateMatch[2];

  return `${normalizedOrgId}_${month}_${year}`;
};

const uploadSalaryData = async (req, res) => {
  try {
    // orgId is required and must come from headers (node lowercases header keys)
    const orgId =
      req.headers.orgid ||
      req.headers["x-org-id"] ||
      req.headers["orgId"] ||
      req.headers["org-id"]; // fallback checks

    if (!orgId) {
      return res
        .status(400)
        .json({ error: "❌ Missing required header: orgId" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "❌ No file uploaded" });
    }

    const fileName = req.file.originalname
      .split(".")[0]
      .replace(/\s+/g, "_")
      .toLowerCase();

    let tableName;
    try {
      tableName = generateTableName(orgId, fileName);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: "",
    });

    if (jsonData.length === 0) {
      return res.status(400).json({ error: "❌ Empty Excel file" });
    }

    const rawColumns = Object.keys(jsonData[0]);

    const formattedColumns = rawColumns.map(formatColumnName);

    const processedData = jsonData.map((row) => {
      let newRow = {};
      rawColumns.forEach((col, index) => {
        newRow[formattedColumns[index]] = row[col] || null;
      });

      if (!newRow.employee_id) {
        newRow.employee_id = newRow.id || generateEmployeeId();
        delete newRow.id;
      }

      Object.keys(newRow).forEach((key) => {
        if (key.includes("date")) {
          let cellValue = newRow[key];

          if (!isNaN(cellValue) && cellValue > 30000) {
            let excelDate = XLSX.SSF.parse_date_code(cellValue);
            newRow[key] = moment(
              new Date(excelDate.y, excelDate.m - 1, excelDate.d)
            ).format("YYYY-MM-DD");
          } else {
            newRow[key] = moment(new Date(cellValue)).isValid()
              ? moment(new Date(cellValue)).format("YYYY-MM-DD")
              : null;
          }
        }
      });

      return newRow;
    });

    if (!(await tableExists(tableName))) {
      await createTableIfNotExists(tableName, formattedColumns);
    }

    await pool.query(deleteExistingData(tableName));

    for (const row of processedData) {
      const { query, values } = insertSalaryData(tableName, row);
      await pool.query(query, values);
    }

    res.status(200).json({
      message: `✅ File uploaded. Data replaced in table: ${tableName}`,
    });
  } catch (error) {
    console.error("❌ Upload error:", error);
    res.status(500).json({ error: "❌ Error processing file" });
  }
};

module.exports = { uploadSalaryData, upload };
