const moment = require("moment");

const {
  checkIfTableExists,
  createTableQuery,
  insertSalaryData,
  getApprovedIdsQuery,
  SALARY_COLUMNS,
  MONETARY_COLUMNS,
} = require("../constants/salaryDetailsQueries");

const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");

const getTenantPoolForOrgId = async (orgId) => {
  if (!orgId) {
    const err = new Error("orgId required to get tenant pool");
    err.code = "ORG_REQUIRED";
    throw err;
  }
  const dbName = sanitizeDbName(`tenant_${orgId}`);
  return getTenantPool(dbName);
};

const generateTableName = (orgId, month = null, year = null) => {
  const now = moment();
  const m = (month || now.format("MMM")).toLowerCase();
  const y = year || now.format("YYYY");
  const safeOrgId = String(orgId).replace(/[^a-zA-Z0-9_]/g, "_");
  return `${safeOrgId}_${m}_${y}`;
};

const tableExists = async (orgId, tableName) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(checkIfTableExists(tableName));
  return rows[0]?.count > 0;
};

const createTableIfNotExists = async (orgId, tableName) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const query = createTableQuery(tableName);
  await tenantPool.query(query);
  return true;
};

const ensureColumns = async (orgId, tableName) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const ALL_COLUMNS = ["employee_id", ...SALARY_COLUMNS.slice(1)];

  for (const col of ALL_COLUMNS) {
    const [rows] = await tenantPool.query(
      `SHOW COLUMNS FROM \`${tableName}\` LIKE ?`,
      [col]
    );

    if (rows.length === 0) {
      let columnType;

      if (col === "employee_id") {
        columnType = "VARCHAR(50) UNIQUE NOT NULL";
      } else if (col === "status") {
        columnType = "VARCHAR(20) DEFAULT 'Pending'";
      } else if (MONETARY_COLUMNS.includes(col)) {
        columnType = "DECIMAL(12,2) DEFAULT NULL";
      } else {
        columnType = "VARCHAR(255) DEFAULT NULL";
      }

      await tenantPool.query(
        `ALTER TABLE \`${tableName}\` ADD COLUMN \`${col}\` ${columnType}`
      );
    }
  }
};

const insertSalaryRecords = async (orgId, tableName, rows) => {
  if (!rows || rows.length === 0) return 0;

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const { query, values } = insertSalaryData(tableName, rows);

  if (!query) return 0;

  const [result] = await tenantPool.query(query, values);
  return result.affectedRows || 0;
};

const saveSalaryDetails = async (salaryData, month, year, orgId) => {
  const tableName = generateTableName(orgId, month, year);

  if (!(await tableExists(orgId, tableName))) {
    await createTableIfNotExists(orgId, tableName);
  }

  await ensureColumns(orgId, tableName);

  const affectedRows = await insertSalaryRecords(orgId, tableName, salaryData);

  return {
    success: true,
    tableName,
    rowsAffected: affectedRows,
  };
};

const getMonthlySalaryData = async (month, year, orgId) => {
  const tableName = generateTableName(orgId, month, year);

  if (!(await tableExists(orgId, tableName))) return [];

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(`SELECT * FROM \`${tableName}\``);
  return rows;
};

const getApprovedEmployeeIds = async (orgId) => {
  const tableName = generateTableName(orgId);

  if (!(await tableExists(orgId, tableName))) return [];

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(getApprovedIdsQuery(tableName));

  return rows.map((r) => r.employee_id);
};

module.exports = {
  saveSalaryDetails,
  generateTableName,
  tableExists,
  createTableIfNotExists,
  ensureColumns,
  insertSalaryRecords,
  getApprovedEmployeeIds,
  getMonthlySalaryData,
};
