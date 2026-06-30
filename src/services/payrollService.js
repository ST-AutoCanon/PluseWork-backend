const payrollQueries = require("../constants/payrollQueries");

const findSalaryTable = async (tenantPool, orgId, month, year) => {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Invalid month");
  }

  if (!Number.isInteger(year)) {
    throw new Error("Invalid year");
  }

  const monthName = new Date(year, month - 1)
    .toLocaleString("en-US", { month: "short" })
    .toLowerCase();

  const expectedTable = `${orgId}_${monthName}_${year}`;

  const [rows] = await tenantPool.query(
    `SHOW TABLES LIKE ?`,
    [expectedTable]
  );

  if (!rows.length) {
    return null;
  }

  return Object.values(rows[0])[0];
};

const getSalarySlip = async (
  tenantPool,
  orgId,
  employee_id,
  month,
  year
) => {
  const tableName = await findSalaryTable(
    tenantPool,
    orgId,
    Number(month),
    Number(year)
  );

  if (!tableName) {
    return null;
  }

  const query = `
    SELECT 
      id,
      employee_id,
      full_name,
      annual_ctc,
      basic_salary,
      hra,
      lta,
      other_allowances,
      incentives,
      overtime,
      statutory_bonus,
      bonus,
      advance_recovery,
      employee_pf,
      employer_pf,
      
      -- FIX: Convert NULL to 0
      COALESCE(esic_employee, 0) AS esic_employee,
      COALESCE(esic_employer, 0) AS esic_employer,
      
      gratuity,
      professional_tax,
      COALESCE(tds, 0) AS tds,
      
      -- FIX: Convert NULL to 0
      COALESCE(insurance_employee, 0) AS insurance_employee,
      COALESCE(insurance_employer, 0) AS insurance_employer,
      
      final_ctc,
      lop_days,
      lop_deduction,
      gross_salary,
      net_salary,
      payslip_generated,
      status,
      payslip_generation,
      created_at
    FROM \`${tableName}\`
    WHERE employee_id = ?
    LIMIT 1
  `;

  const [rows] = await tenantPool.execute(query, [employee_id]);

  return rows.length ? rows[0] : null;
};
const getEmployeeBankDetails = async (tenantPool, employee_id) => {
  const [rows] = await tenantPool.execute(
    payrollQueries.GETEMPLOYEEBANKDETAILSQUERY,
    [employee_id]
  );

  return rows[0] || null;
};

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
