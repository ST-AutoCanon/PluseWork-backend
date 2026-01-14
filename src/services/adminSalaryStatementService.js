const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");

const normalizeMonth = (month) => {
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

  if (/^\d{1,2}$/.test(month)) {
    const idx = parseInt(month, 10);
    if (idx >= 1 && idx <= 12) return months[idx - 1];
  }

  const m = month.slice(0, 3).toLowerCase();
  if (months.includes(m)) return m;

  throw new Error("Invalid month (use 1-12 or jan-dec)");
};

const normalizeYear = (year) => {
  const y = String(year).trim();
  if (!/^\d{4}$/.test(y)) throw new Error("Invalid year, must be 4 digits");
  return y;
};

const wrapTableName = (tenantId, month, year) => {
  return `\`${tenantId}_${month}_${year}\``;
};

const tableExists = async (tenantPool, tableName) => {
  const [rows] = await tenantPool.query(
    `SELECT COUNT(*) AS count FROM information_schema.tables 
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName.replace(/`/g, "")]
  );
  return rows[0].count > 0;
};

const getSalaryStatement = async (tenantId, month, year) => {
  const normalizedMonth = normalizeMonth(month);
  const normalizedYear = normalizeYear(year);

  const tableName = wrapTableName(tenantId, normalizedMonth, normalizedYear);

  const tenantPool = await getTenantPoolByOrgId(tenantId);

  if (!(await tableExists(tenantPool, tableName))) {
    console.warn(`Table ${tableName} does not exist.`);
    return [];
  }

  const [rows] = await tenantPool.query(`SELECT * FROM ${tableName}`);
  return rows;
};

const getEmployeeBankDetails = async (employeeId) => {
  const masterDb = require("../config");
  const [rows] = await masterDb.query(
    "SELECT * FROM employee_bank_details WHERE employee_id = ?",
    [employeeId]
  );
  return rows.length ? rows[0] : null;
};

const updatePayslipGenerated = async (
  tenantId,
  month,
  year,
  employeeId,
  newValue
) => {
  const normalizedMonth = normalizeMonth(month);
  const normalizedYear = normalizeYear(year);

  const tableName = wrapTableName(tenantId, normalizedMonth, normalizedYear);

  const tenantPool = await getTenantPoolByOrgId(tenantId);

  if (!(await tableExists(tenantPool, tableName))) {
    throw new Error(`Salary table ${tableName} does not exist`);
  }

  const [result] = await tenantPool.query(
    `UPDATE ${tableName} SET payslip_generated = ? WHERE employee_id = ?`,
    [newValue, employeeId]
  );

  return result;
};

module.exports = {
  getSalaryStatement,
  getEmployeeBankDetails,
  updatePayslipGenerated,
};
