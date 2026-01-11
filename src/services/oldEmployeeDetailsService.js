const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const queries = require("../constants/oldEmployeeDetails");

const insertOldEmployeeDetails = async (data, orgId) => {
  const tenantPool = await getTenantPoolByOrgId(orgId);

  const values = [
    orgId,
    data.employee_name,
    data.employee_id,
    data.gender,
    data.designation,
    data.date_of_joining,
    data.account_no,
    Number(data.working_days) || 0,
    Number(data.leaves_taken) || 0,
    data.uin_no,
    data.pan_number,
    data.esi_number,
    data.pf_number,
    Number(data.basic) || 0,
    Number(data.hra) || 0,
    Number(data.other_allowance) || 0,
    Number(data.pf) || 0,
    Number(data.esi_insurance) || 0,
    Number(data.professional_tax) || 0,
    Number(data.tds) || 0,
    Number(data.gross_earnings) || 0,
    Number(data.total_deductions) || 0,
    Number(data.net_salary) || 0,
    data.month,
    data.year,
  ];

  const [result] = await tenantPool.execute(
    queries.INSERT_OLD_EMPLOYEE_DETAILS,
    values
  );

  return result;
};

const getAllOldEmployeeDetails = async (orgId) => {
  const tenantPool = await getTenantPoolByOrgId(orgId);
  const [rows] = await tenantPool.execute(
    queries.GET_ALL_OLD_EMPLOYEE_DETAILS,
    [orgId]
  );
  return rows;
};

const updateOldEmployeeDetails = async (data, orgId) => {
  const tenantPool = await getTenantPoolByOrgId(orgId);

  const values = [
    data.employee_name,
    data.gender,
    data.designation,
    data.date_of_joining,
    data.account_no,
    Number(data.working_days) || 0,
    Number(data.leaves_taken) || 0,
    data.uin_no,
    data.pan_number,
    data.esi_number,
    data.pf_number,
    Number(data.basic) || 0,
    Number(data.hra) || 0,
    Number(data.other_allowance) || 0,
    Number(data.pf) || 0,
    Number(data.esi_insurance) || 0,
    Number(data.professional_tax) || 0,
    Number(data.tds) || 0,
    Number(data.gross_earnings) || 0,
    Number(data.total_deductions) || 0,
    Number(data.net_salary) || 0,
    data.month,
    data.year,
    data.employee_id,
    orgId,
  ];

  const [result] = await tenantPool.execute(
    queries.UPDATE_OLD_EMPLOYEE_DETAILS,
    values
  );

  return result;
};

const fetchEmployeeDetails = async (orgId) => {
  const tenantPool = await getTenantPoolByOrgId(orgId);
  const [rows] = await tenantPool.execute(
    queries.GET_EMPLOYEES,
    [orgId]
  );
  return rows;
};

module.exports = {
  insertOldEmployeeDetails,
  getAllOldEmployeeDetails,
  updateOldEmployeeDetails,
  fetchEmployeeDetails,
};
