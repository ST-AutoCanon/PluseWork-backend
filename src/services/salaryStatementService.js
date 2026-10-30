// src/services/salaryStatementService.js

const xlsx = require('xlsx');
const { getTenantPoolByOrgId } = require('../db/tenantPoolManager');

/**
 * Standardized table name format: `${orgId}_${month.toLowerCase()}_${year}`
 */
function getTableName(orgId, month, year) {
  return `\`${orgId}_${month.toLowerCase()}_${year}\``;
}

// ────────────────────────────────────────────────
// Mapping: Excel Header → Database Column
// Updated to match your actual table structure
// ────────────────────────────────────────────────
const COLUMN_MAPPING = {
  "ID":                    "employee_id",
  "Employee ID":           "employee_id",

  "Name":                  "full_name",
  "Full Name":             "full_name",

  "Annual CTC":            "annual_ctc",
  "Basic Salary":          "basic_salary",
  "HRA":                   "hra",
  "LTA":                   "lta",
  "Other Allowances":      "other_allowances",
  "Incentives":            "incentives",
  "Overtime":              "overtime",
  "Statutory Bonus":       "statutory_bonus",
  "Bonus":                 "bonus",
  "Advance Recovery":      "advance_recovery",
  "Employee PF":           "employee_pf",
  "Employer PF":           "employer_pf",

  "ESIC":                  "esic_employee",
  "ESIC Employee":         "esic_employee",
  "ESIC Employer":         "esic_employer",

  "Gratuity":              "gratuity",
  "Professional Tax":      "professional_tax",
  "TDS":                   "tds",

  "Insurance":             "insurance_employee",
  "Insurance Employee":    "insurance_employee",
  "Insurance Employer":    "insurance_employer",
  "Final CTC":             "final_ctc",
  "Base Net Salary":       "base_net_salary",

  "LOP Days":              "lop_days",
  "Approved Leave Count (LOP Days)": "approved_leave_count",
  "LOP Deduction":         "lop_deduction",
  "Late Login Eligible Count (Total Violations)": "late_login_count",
  "Late Login Amount":     "late_login_deduction",
  "Miss Punch Out Eligible Count (Total Violations)": "miss_punch_out_count",
  "Miss Punch Out Amount": "miss_punch_out_deduction",
  "Less Login Hours Eligible Count (Total Violations)": "less_login_hours_count",
  "Less Login Hours Amount": "less_login_hours_deduction",
  "Gross Salary":          "gross_salary",
  "Net Salary":            "net_salary",
  "Net Salary After Attendance Deductions": "net_salary_after_attendance_deduction",
};

function normalizeHeader(header) {
  return (header || '').toString().trim();
}

function toSafeColumnName(header) {
  let name = String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  if (!name || /^\d/.test(name)) name = `column_${name || 'value'}`;
  if (name === 'id') name = 'custom_id';
  return name;
}

async function ensureUploadColumns(connection, tableName, headers, jsonData) {
  const [existingRows] = await connection.query(`SHOW COLUMNS FROM ${tableName}`);
  const existing = new Set(existingRows.map((row) => row.Field));

  for (const header of headers) {
    const normHeader = normalizeHeader(header);
    const dbCol = COLUMN_MAPPING[normHeader] || toSafeColumnName(normHeader);
    if (existing.has(dbCol)) continue;

    const values = jsonData.map((row) => row[header]).filter((value) => value !== null && value !== undefined && String(value).trim() !== '');
    const numeric = values.length > 0 && values.every((value) => /^[-+]?\d+(\.\d+)?$/.test(String(value).trim().replace(/,/g, '')));
    const columnType = numeric ? 'DECIMAL(15,2) DEFAULT NULL' : 'TEXT NULL';
    await connection.query(`ALTER TABLE ${tableName} ADD COLUMN \`${dbCol}\` ${columnType}`);
    existing.add(dbCol);
  }
}

async function uploadSalaryData(req, res) {
  let connection = null;

  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const orgId = req.headers['x-org-id'];
    if (!orgId) {
      return res.status(400).json({ error: "Organization ID is required in headers (x-org-id)" });
    }

    const tenantPool = await getTenantPoolByOrgId(orgId);
    connection = await tenantPool.getConnection();

    const month = (req.body.month || '').toLowerCase().trim();
    const year = (req.body.year || '').trim();

    if (!month || !year || !/^[a-z]{3}$/.test(month) || !/^\d{4}$/.test(year)) {
      return res.status(400).json({ error: "Missing or invalid month/year" });
    }

    const tableName = getTableName(orgId, month, year);

    // Check if table exists
    const [tables] = await connection.query(`SHOW TABLES LIKE ?`, [`${orgId}_${month}_${year}`]);

    if (tables.length === 0) {
      console.info(`Creating new table: ${tableName}`);

      const createTableSql = `
        CREATE TABLE ${tableName} (
          id INT NOT NULL AUTO_INCREMENT,
          employee_id VARCHAR(50) NOT NULL,
          full_name VARCHAR(100) DEFAULT NULL,
          annual_ctc DECIMAL(15,2) DEFAULT 0.00,
          basic_salary DECIMAL(15,2) DEFAULT 0.00,
          hra DECIMAL(15,2) DEFAULT 0.00,
          lta DECIMAL(15,2) DEFAULT 0.00,
          other_allowances DECIMAL(15,2) DEFAULT 0.00,
          incentives DECIMAL(15,2) DEFAULT 0.00,
          overtime DECIMAL(15,2) DEFAULT 0.00,
          statutory_bonus DECIMAL(15,2) DEFAULT 0.00,
          bonus DECIMAL(15,2) DEFAULT 0.00,
          advance_recovery DECIMAL(15,2) DEFAULT 0.00,
          employee_pf DECIMAL(15,2) DEFAULT 0.00,
          employer_pf DECIMAL(15,2) DEFAULT 0.00,
          esic_employee DECIMAL(15,2) DEFAULT 0.00,
          esic_employer DECIMAL(15,2) DEFAULT 0.00,
          gratuity DECIMAL(15,2) DEFAULT 0.00,
          professional_tax DECIMAL(15,2) DEFAULT 0.00,
          tds DECIMAL(12,2) DEFAULT 0.00,
          insurance_employee DECIMAL(12,2) DEFAULT 0.00,
          insurance_employer DECIMAL(12,2) DEFAULT 0.00,
          final_ctc DECIMAL(15,2) DEFAULT 0.00,
          lop_days INT DEFAULT 0,
          lop_deduction DECIMAL(12,2) DEFAULT 0.00,
          approved_leave_count INT DEFAULT 0,
          late_login_count VARCHAR(255) DEFAULT NULL,
          late_login_deduction DECIMAL(15,2) DEFAULT 0.00,
          miss_punch_out_count VARCHAR(255) DEFAULT NULL,
          miss_punch_out_deduction DECIMAL(15,2) DEFAULT 0.00,
          less_login_hours_count VARCHAR(255) DEFAULT NULL,
          less_login_hours_deduction DECIMAL(15,2) DEFAULT 0.00,
          base_net_salary DECIMAL(15,2) DEFAULT 0.00,
          net_salary_after_attendance_deduction DECIMAL(15,2) DEFAULT 0.00,
          gross_salary DECIMAL(15,2) DEFAULT 0.00,
          net_salary DECIMAL(15,2) DEFAULT 0.00,
          payslip_generated INT NOT NULL DEFAULT 0,
          status VARCHAR(20) DEFAULT 'Approved',
          payslip_generation VARCHAR(20) DEFAULT 'disabled',
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uk_employee_id (employee_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
      `;

      await connection.query(createTableSql);
    }

    // Read Excel
    const workbook = xlsx.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const headers = xlsx.utils.sheet_to_json(worksheet, { header: 1, range: 0, defval: '' })[0]
      .map(normalizeHeader);

    const jsonData = xlsx.utils.sheet_to_json(worksheet, {
      header: headers,
      range: 1,
      defval: null,
      raw: false
    });

    if (jsonData.length === 0) {
      return res.status(400).json({ error: "No data rows found in the file" });
    }

    await ensureUploadColumns(connection, tableName, headers, jsonData);

    const values = [];
    const errors = [];

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const mappedRow = {};

      Object.keys(row).forEach(excelHeader => {
        const normHeader = normalizeHeader(excelHeader);
        const dbCol = COLUMN_MAPPING[normHeader] || toSafeColumnName(normHeader);

        if (dbCol) {
          let val = row[excelHeader];
          if (typeof val === 'string') val = val.trim() || null;

          if (dbCol === 'lop_days' || dbCol === 'approved_leave_count') {
            val = val ? parseInt(val, 10) || 0 : 0;
          } else if (COLUMN_MAPPING[normHeader] && !['employee_id', 'full_name', 'late_login_count', 'miss_punch_out_count', 'less_login_hours_count'].includes(dbCol)) {
            const numericVal = typeof val === 'string' ? val.replace(/,/g, '').match(/^[-+]?\d+(\.\d+)?/)?.[0] : val;
            val = numericVal !== null && numericVal !== undefined && numericVal !== '' ? parseFloat(numericVal) || 0 : val;
          }

          mappedRow[dbCol] = val;
        }
      });

      if (!mappedRow.employee_id || String(mappedRow.employee_id).trim() === '') {
        errors.push(`Row ${i + 2}: Missing or empty Employee ID`);
        continue;
      }

      values.push(mappedRow);
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: "Validation errors in uploaded file",
        details: errors
      });
    }

    if (values.length === 0) {
      return res.status(400).json({ error: "No valid rows to insert" });
    }

    // Insert Query
    const columns = Object.keys(values[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const columnList = columns.map(c => `\`${c}\``).join(', ');

    const sql = `
      INSERT INTO ${tableName} (${columnList})
      VALUES ${values.map(() => `(${placeholders})`).join(', ')}
      ON DUPLICATE KEY UPDATE
      ${columns.map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(', ')}
    `;

    const flatValues = [];
    values.forEach(row => {
      columns.forEach(col => flatValues.push(row[col]));
    });

    await connection.query(sql, flatValues);

    return res.status(200).json({
      message: `Successfully processed ${values.length} employee records for ${month.toUpperCase()} ${year}`,
      count: values.length
    });

  } catch (err) {
    console.error("[Salary Upload] Error:", err);
    return res.status(500).json({
      error: "Failed to upload salary data",
      details: err.message
    });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  uploadSalaryData,
};