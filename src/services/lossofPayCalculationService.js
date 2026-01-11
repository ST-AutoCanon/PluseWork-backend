// services/lossofPayCalculationService.js

const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const {
  GET_CURRENT_MONTH_LOP,
  GET_DEFERRED_LOP,
  GET_NEXT_MONTH_LOP,
} = require("../constants/lossofPayCalculationQueries");

/**
 * Get Current Month LOP (up to cutoff date)
 */
const getCurrentMonthLOP = async (orgId) => {
  if (!orgId) throw new Error("orgId required");

const tenantPool = await getTenantPoolByOrgId(orgId);
  const [rows] = await tenantPool.query(GET_CURRENT_MONTH_LOP, [orgId]);
  return rows;
};

/**
 * Get Deferred LOP (after cutoff date in current month)
 */
const getDeferredLOP = async (orgId) => {
  if (!orgId) throw new Error("orgId required");

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(GET_DEFERRED_LOP, [orgId]);
  return rows;
};

/**
 * Get LOP for Next Month (carry forward)
 */
const getNextMonthLOP = async (orgId) => {
  if (!orgId) throw new Error("orgId required");

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(GET_NEXT_MONTH_LOP); // no params needed
  return rows;
};

module.exports = {
  getCurrentMonthLOP,
  getDeferredLOP,
  getNextMonthLOP,
};