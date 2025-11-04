const pool = require("../config");
const queries = require("../constants/oldEmployeeDetails");

const insertOldEmployeeDetails = async (data, orgId) => {
  const {
    employee_name,
    employee_id,
    gender,
    designation,
    date_of_joining,
    account_no,
    working_days,
    leaves_taken,
    uin_no,
    pan_number,
    esi_number,
    pf_number,
    basic,
    hra,
    other_allowance,
    pf,
    esi_insurance,
    professional_tax,
    tds,
    gross_earnings,
    total_deductions,
    net_salary,
    month,
    year,
  } = data;

  // Validate required fields
  if (
    !orgId ||
    !employee_name ||
    !employee_id ||
    !date_of_joining ||
    !month ||
    !year
  ) {
    throw new Error(
      "Missing required fields: employee_name, employee_id, date_of_joining, month, or year"
    );
  }

  // Validate data formats
  if (!["Male", "Female", "Other"].includes(gender)) {
    throw new Error("Gender must be Male, Female, or Other");
  }
  if (!pan_number || !pan_number.match(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)) {
    throw new Error("Invalid PAN number format (e.g., ABCDE1234F)");
  }
  if (month < 1 || month > 12) {
    throw new Error("Month must be between 1 and 12");
  }
  if (year < 1900 || year > new Date().getFullYear()) {
    throw new Error("Year must be between 1900 and the current year");
  }

  // Ensure correct types and handle nulls
  const values = [
    orgId || null,
    employee_name || null,
    employee_id || null,
    gender || null,
    designation || null,
    date_of_joining || null,
    account_no || null,
    Number(working_days) || 0,
    Number(leaves_taken) || 0,
    uin_no || null,
    pan_number || null,
    esi_number || null,
    pf_number || null,
    Number(basic) ? parseFloat(Number(basic).toFixed(2)) : 0, // Ensure DECIMAL(10,2)
    Number(hra) ? parseFloat(Number(hra).toFixed(2)) : 0,
    Number(other_allowance)
      ? parseFloat(Number(other_allowance).toFixed(2))
      : 0,
    Number(pf) ? parseFloat(Number(pf).toFixed(2)) : 0,
    Number(esi_insurance) ? parseFloat(Number(esi_insurance).toFixed(2)) : 0,
    Number(professional_tax)
      ? parseFloat(Number(professional_tax).toFixed(2))
      : 0,
    Number(tds) ? parseFloat(Number(tds).toFixed(2)) : 0,
    Number(gross_earnings) ? parseFloat(Number(gross_earnings).toFixed(2)) : 0,
    Number(total_deductions)
      ? parseFloat(Number(total_deductions).toFixed(2))
      : 0,
    Number(net_salary) ? parseFloat(Number(net_salary).toFixed(2)) : 0,
    Number(month) || null,
    Number(year) || null,
  ];

  try {
    const [result] = await pool.execute(
      queries.INSERT_OLD_EMPLOYEE_DETAILS,
      values
    );
    return result;
  } catch (err) {
    console.error("Database error:", err);
    throw new Error(`Failed to insert employee data: ${err.message}`);
  }
};

const getAllOldEmployeeDetails = async (orgId) => {
  if (orgId === undefined || orgId === null) {
    throw new Error("orgId is required");
  }

  try {
    const [rows] = await pool.execute(queries.GET_ALL_OLD_EMPLOYEE_DETAILS, [
      orgId,
    ]);
    return rows;
  } catch (err) {
    console.error("Error in getAllOldEmployeeDetails:", err);
    throw err;
  }
};

const updateOldEmployeeDetails = async (data, orgId) => {
  const {
    employee_name,
    employee_id,
    gender,
    designation,
    date_of_joining,
    account_no,
    working_days,
    leaves_taken,
    uin_no,
    pan_number,
    esi_number,
    pf_number,
    basic,
    hra,
    other_allowance,
    pf,
    esi_insurance,
    professional_tax,
    tds,
    gross_earnings,
    total_deductions,
    net_salary,
    month,
    year,
  } = data;

  if (
    !orgId ||
    !employee_name ||
    !employee_id ||
    !date_of_joining ||
    !month ||
    !year
  ) {
    throw new Error(
      "Missing required fields: employee_name, employee_id, date_of_joining, month, or year"
    );
  }

  if (!["Male", "Female", "Other"].includes(gender)) {
    throw new Error("Gender must be Male, Female, or Other");
  }
  if (!pan_number || !pan_number.match(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)) {
    throw new Error("Invalid PAN number format (e.g., ABCDE1234F)");
  }
  if (month < 1 || month > 12) {
    throw new Error("Month must be between 1 and 12");
  }
  if (year < 1900 || year > new Date().getFullYear()) {
    throw new Error("Year must be between 1900 and the current year");
  }

  const values = [
    employee_name || null,
    gender || null,
    designation || null,
    date_of_joining || null,
    account_no || null,
    Number(working_days) || 0,
    Number(leaves_taken) || 0,
    uin_no || null,
    pan_number || null,
    esi_number || null,
    pf_number || null,
    Number(basic) ? parseFloat(Number(basic).toFixed(2)) : 0,
    Number(hra) ? parseFloat(Number(hra).toFixed(2)) : 0,
    Number(other_allowance)
      ? parseFloat(Number(other_allowance).toFixed(2))
      : 0,
    Number(pf) ? parseFloat(Number(pf).toFixed(2)) : 0,
    Number(esi_insurance) ? parseFloat(Number(esi_insurance).toFixed(2)) : 0,
    Number(professional_tax)
      ? parseFloat(Number(professional_tax).toFixed(2))
      : 0,
    Number(tds) ? parseFloat(Number(tds).toFixed(2)) : 0,
    Number(gross_earnings) ? parseFloat(Number(gross_earnings).toFixed(2)) : 0,
    Number(total_deductions)
      ? parseFloat(Number(total_deductions).toFixed(2))
      : 0,
    Number(net_salary) ? parseFloat(Number(net_salary).toFixed(2)) : 0,
    Number(month) || null,
    Number(year) || null,
    employee_id,
    orgId,
  ];

  try {
    const [result] = await pool.execute(
      queries.UPDATE_OLD_EMPLOYEE_DETAILS,
      values
    );
    return result;
  } catch (err) {
    console.error("Database error:", err);
    throw new Error(`Failed to update employee data: ${err.message}`);
  }
};

const fetchEmployeeDetails = async (orgId) => {
  if (!orgId) {
    throw new Error("orgId is required");
  }

  try {
    const [rows] = await pool.execute(queries.GET_EMPLOYEES, [orgId]);
    // rows will be an array (empty if none)
    return rows;
  } catch (error) {
    console.error("❌ Error fetching employees from database:", error);
    throw new Error("Error fetching employees from database");
  }
};

module.exports = {
  insertOldEmployeeDetails,
  getAllOldEmployeeDetails,
  updateOldEmployeeDetails,
  fetchEmployeeDetails,
};
