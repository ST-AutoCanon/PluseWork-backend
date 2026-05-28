const {
  INSERT_COMPENSATION_PLAN,
  INSERT_COMPENSATION_WORKING_DAYS,
  GET_ALL_COMPENSATION_PLANS,
  GET_COMPENSATION_PLAN_BY_ID,
  UPDATE_COMPENSATION_PLAN,
  UPDATE_COMPENSATION_WORKING_DAYS,
  DELETE_COMPENSATION_PLAN,
  DELETE_COMPENSATION_WORKING_DAYS,
  GET_ALL_EMPLOYEE_FULL_NAMES,
  GET_ALL_DEPARTMENT_NAMES,
  GET_EMPLOYEES_BY_DEPARTMENT_ID,
} = require("../constants/compensationPlans");

const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");

const getTenantPoolForOrg = async (orgId) => {
  if (!orgId) throw new Error("orgId required");
  const dbName = sanitizeDbName(`tenant_${orgId}`);
  return getTenantPool(dbName);
};

const addCompensation = async (orgId, data) => {
  const pool = await getTenantPoolForOrg(orgId);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [res] = await conn.query(INSERT_COMPENSATION_PLAN, [
      data.compensationPlanName,
      JSON.stringify(data.formData),
      orgId,
    ]);

    const planId = res.insertId;
    const wd = data.formData.defaultWorkingDays || {};

    await conn.query(INSERT_COMPENSATION_WORKING_DAYS, [
      planId,
      wd.Sunday || "weekOff",
      wd.Monday || "fullDay",
      wd.Tuesday || "fullDay",
      wd.Wednesday || "fullDay",
      wd.Thursday || "fullDay",
      wd.Friday || "fullDay",
      wd.Saturday || "weekOff",
    ]);

    await conn.commit();
    return { planId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const getAllCompensations = async (orgId) => {
  const pool = await getTenantPoolForOrg(orgId);
  const [rows] = await pool.query(GET_ALL_COMPENSATION_PLANS, [orgId]);
  return rows;
};

const getCompensationByEmployeeId = async (orgId, id) => {
  const pool = await getTenantPoolForOrg(orgId);
  const [rows] = await pool.query(GET_COMPENSATION_PLAN_BY_ID, [id]);
  return rows;
};

const updateCompensation = async (orgId, id, data) => {
  const pool = await getTenantPoolForOrg(orgId);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(UPDATE_COMPENSATION_PLAN, [
      data.compensationPlanName,
      JSON.stringify(data.formData),
      id,
    ]);

    const wd = data.formData.defaultWorkingDays || {};
    await conn.query(UPDATE_COMPENSATION_WORKING_DAYS, [
      wd.Sunday || "weekOff",
      wd.Monday || "fullDay",
      wd.Tuesday || "fullDay",
      wd.Wednesday || "fullDay",
      wd.Thursday || "fullDay",
      wd.Friday || "fullDay",
      wd.Saturday || "weekOff",
      id,
    ]);

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

const deleteCompensation = async (orgId, id) => {
  const pool = await getTenantPoolForOrg(orgId);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    await conn.query(DELETE_COMPENSATION_WORKING_DAYS, [id]);
    await conn.query(DELETE_COMPENSATION_PLAN, [id]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

const getAllEmployeeNames = async (orgId) => {
  const pool = await getTenantPoolForOrg(orgId);
  const [rows] = await pool.query(GET_ALL_EMPLOYEE_FULL_NAMES, [orgId]);
  return rows;
};

const getAllDepartmentNames = async (orgId) => {
  const pool = await getTenantPoolForOrg(orgId);

  const [rows] = await pool.query(GET_ALL_DEPARTMENT_NAMES, [
    orgId,
  ]);

  return rows;
};

const getEmployeesByDepartmentId = async (orgId, departmentId) => {
  const pool = await getTenantPoolForOrg(orgId);
  const [rows] = await pool.query(GET_EMPLOYEES_BY_DEPARTMENT_ID, [
    departmentId,
    orgId,
  ]);
  return rows;
};

module.exports = {
  addCompensation,
  getAllCompensations,
  getCompensationByEmployeeId,
  updateCompensation,
  deleteCompensation,
  getAllEmployeeNames,
  getAllDepartmentNames,
  getEmployeesByDepartmentId,
};
