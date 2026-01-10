const queries = require("../constants/adminAttendancetracker");
const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");

async function getTenantPoolForOrgId(orgId) {
  if (!orgId) {
    const err = new Error("orgId required to get tenant pool");
    err.code = "ORG_REQUIRED";
    throw err;
  }
  const dbName = sanitizeDbName(`tenant_${orgId}`);
  return getTenantPool(dbName);
}

const getMissingPunchInEmployees = async (orgId) => {
  try {
    const db = await getTenantPoolForOrgId(orgId);
    const [rows] = await db.query(queries.GET_MISSING_PUNCH_IN_EMPLOYEES);
    return rows;
  } catch (error) {
    console.error("Error fetching missing punch-in employees:", error);
    throw new Error("Error fetching missing punch-in employees");
  }
};

const getEmployeesWithPunchInNotPunchedOut = async (orgId) => {
  try {
    const db = await getTenantPoolForOrgId(orgId);
    const [rows] = await db.query(
      queries.GET_EMPLOYEES_WITH_PUNCH_IN_NOT_PUNCHED_OUT
    );
    return rows;
  } catch (error) {
    console.error(
      "Error fetching employees with punch-in but not punched out:",
      error
    );
    throw new Error(
      "Error fetching employees with punch-in but not punched out"
    );
  }
};

const getEmployeesWorkedLessThan8Hours = async (orgId) => {
  try {
    const db = await getTenantPoolForOrgId(orgId);
    const [rows] = await db.query(
      queries.GET_EMPLOYEES_WORKED_LESS_THAN_8_HOURS
    );
    return rows;
  } catch (error) {
    console.error(
      "Error fetching employees who worked less than 8 hours:",
      error
    );
    throw new Error("Error fetching employees who worked less than 8 hours");
  }
};

const getEmployeesWorked8To10Hours = async (orgId) => {
  try {
    const db = await getTenantPoolForOrgId(orgId);
    const [rows] = await db.query(queries.GET_EMPLOYEES_WORKED_8_TO_10_HOURS);
    return rows;
  } catch (error) {
    console.error("Error fetching employees who worked 8 to 10 hours:", error);
    throw new Error("Error fetching employees who worked 8 to 10 hours");
  }
};

const getApprovedLeavesCurrentMonth = async (orgId) => {
  try {
    const db = await getTenantPoolForOrgId(orgId);
    const [rows] = await db.query(queries.GET_APPROVED_LEAVES_CURRENT_MONTH);
    return rows;
  } catch (error) {
    console.error(
      "Error fetching approved leaves for the current month:",
      error
    );
    throw new Error("Error fetching approved leaves for the current month");
  }
};

module.exports = {
  getMissingPunchInEmployees,
  getEmployeesWithPunchInNotPunchedOut,
  getEmployeesWorkedLessThan8Hours,
  getEmployeesWorked8To10Hours,
  getApprovedLeavesCurrentMonth,
};
