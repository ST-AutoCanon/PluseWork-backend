const db = require("../config");
const queries = require("../constants/customerQueries");
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

const createCustomer = async (orgId, customerData) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [result] = await tenantPool.query(
      queries.INSERT_CUSTOMER,
      customerData,
    );
    return result.insertId;
  } catch (err) {
    console.error("❌ createCustomer error:", err);
    throw err;
  }
};

const getCustomers = async (orgId) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [rows] = await tenantPool.query(queries.GET_ALL_CUSTOMERS);
    return rows;
  } catch (err) {
    console.error("❌ getCustomers error:", err);
    throw err;
  }
};

const getCustomerById = async (orgId, id) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [rows] = await tenantPool.query(queries.GET_CUSTOMER_BY_ID, [id]);
    return rows && rows.length ? rows[0] : null;
  } catch (err) {
    console.error("❌ getCustomerById error:", err);
    throw err;
  }
};

const updateCustomer = async (orgId, id, customerData) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    await tenantPool.query(queries.UPDATE_CUSTOMER, [...customerData, id]);
  } catch (err) {
    console.error("❌ updateCustomer error:", err);
    throw err;
  }
};

module.exports = {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
};
