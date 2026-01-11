const payrollQueries = require("../constants/payrollQueries");

/* ==============================
   FIND SALARY TABLE
   format: 1_jan_2026
============================== */
const findSalaryTable = async (tenantPool, month, year) => {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Invalid month");
  }

  if (!Number.isInteger(year)) {
    throw new Error("Invalid year");
  }

  const monthName = new Date(year, month - 1)
    .toLocaleString("en-US", { month: "short" })
    .toLowerCase();

  const expectedTable = `1_${monthName}_${year}`;

  // ❌ DO NOT use execute() here
  // ✅ Use query() instead
  const [rows] = await tenantPool.query(
    `SHOW TABLES LIKE ${tenantPool.escape(expectedTable)}`
  );

  if (!rows.length) return null;

  return Object.values(rows[0])[0];
};


/* ==============================
   GET SALARY SLIP
============================== */
const getSalarySlip = async (tenantPool, employee_id, month, year) => {
  const tableName = await findSalaryTable(
    tenantPool,
    Number(month),
    Number(year)
  );

  if (!tableName) return null;

  // ✅ table name interpolated correctly
  const query = `
    SELECT *
    FROM \`${tableName}\`
    WHERE employee_id = ?
    LIMIT 1
  `;

  const [rows] = await tenantPool.execute(query, [employee_id]);

  if (!rows.length) return null;

  return rows[0];
};

/* ==============================
   BANK DETAILS
============================== */
const getEmployeeBankDetails = async (tenantPool, employee_id) => {
  const [rows] = await tenantPool.execute(
    payrollQueries.GETEMPLOYEEBANKDETAILSQUERY,
    [employee_id]
  );

  return rows[0] || null;
};

/* ==============================
   EMPLOYEE DETAILS
============================== */
const getEmployeeDetails = async (tenantPool, employee_id) => {
  const [rows] = await tenantPool.execute(
    payrollQueries.GET_EMPLOYEE_DETAILS_QUERY,
    [employee_id]
  );

  return rows[0] || null;
};

module.exports = {
  getSalarySlip,
  getEmployeeBankDetails,
  getEmployeeDetails,
};
