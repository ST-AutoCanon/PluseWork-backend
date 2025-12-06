const pool = require("../config");
const {
  getSalaryStatementQuery,
  GETEMPLOYEEBANKDETAILSQUERY,
} = require("../constants/adminSalaryStatement");

const normalizeMonth = (month) => {
  if (!month) throw new Error("Missing month");
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  let m = String(month).toLowerCase().trim();

  if (/^\d{1,2}$/.test(m)) {
    const idx = parseInt(m, 10);
    if (idx >= 1 && idx <= 12) return months[idx - 1];
  }

  m = m.slice(0, 3);
  if (months.includes(m)) return m;

  throw new Error(
    "Invalid month. Provide numeric (3) or name (mar, march) format"
  );
};

const normalizeYear = (year) => {
  if (!year) throw new Error("Missing year");
  const y = String(year).trim();
  if (!/^\d{4}$/.test(y)) {
    throw new Error("Invalid year. Provide 4-digit year like 2025");
  }
  return y;
};

const normalizeOrgId = (orgId) => {
  if (!orgId) throw new Error("Missing orgId");
  const normalized = String(orgId)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  if (!normalized) throw new Error("Invalid orgId header value");
  return normalized;
};

const tableExists = async (tableName) => {
  const sql = `SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`;
  const [rows] = await pool.query(sql, [tableName]);
  const count = rows && rows[0] ? rows[0].count : rows.count || 0;
  return Number(count) > 0;
};

const getSalaryStatement = async (orgId, month, year) => {
  try {
    const normalizedOrgId = normalizeOrgId(orgId);
    const normalizedMonth = normalizeMonth(month);
    const normalizedYear = normalizeYear(year);

    const tableName = `${normalizedOrgId}_${normalizedMonth}_${normalizedYear}`;

    const exists = await tableExists(tableName);
    if (!exists) {
      console.warn(`Table ${tableName} does not exist.`);
      return [];
    }

    const [rows] = await pool.query(getSalaryStatementQuery(tableName));
    return rows;
  } catch (error) {
    console.error("Error fetching salary statement:", error);
    throw error;
  }
};

const getEmployeeBankDetails = async (employeeId) => {
  try {
    const [rows] = await pool.query(GETEMPLOYEEBANKDETAILSQUERY, [employeeId]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error("Error fetching employee bank details:", error);
    throw error;
  }
};

module.exports = {
  getSalaryStatement,
  getEmployeeBankDetails,
};
