const queries = require("../constants/vendorQueries");
const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");

/**
 * Resolve tenant pool for an orgId — throws "Organization not found" if the database does not exist.
 */
async function getTenantPoolForOrgId(orgId) {
  if (!orgId) {
    throw new Error("org_id header is required");
  }
  const dbName = sanitizeDbName(`tenant_${orgId}`);
  try {
    return await getTenantPool(dbName);
  } catch (poolError) {
    console.error(`Failed to connect to tenant database ${dbName}:`, poolError);
    if (poolError.code === "ER_BAD_DB_ERROR" || poolError.message.includes("Unknown database")) {
      throw new Error("Organization not found");
    }
    throw poolError;
  }
}

const insertVendor = async (vendorData, orgId) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const params = [orgId, ...vendorData];
    const [result] = await tenantPool.query(queries.INSERT_VENDOR, params);
    return result;
  } catch (error) {
    console.error("❌ Error inserting vendor:", error);
    if (error.message === "Organization not found") {
      throw error; // Propagate for handler to catch as 404
    }
    throw new Error("Failed to add vendor");
  }
};

const getVendorsByOrgId = async (orgId) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [rows] = await tenantPool.query(queries.GET_VENDORS_BY_ORGID, [orgId]);
    return rows;
  } catch (error) {
    console.error("❌ Error fetching vendors:", error);
    if (error.message === "Organization not found") {
      throw error;
    }
    throw new Error("Failed to retrieve vendors");
  }
};

const getVendorById = async (vendor_id, orgId) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [rows] = await tenantPool.query(queries.GET_VENDOR_BY_ID, [vendor_id, orgId]);
    return rows.length ? rows[0] : null;
  } catch (error) {
    console.error("❌ Error fetching vendor by id:", error);
    if (error.message === "Organization not found") {
      throw error;
    }
    throw new Error("Failed to retrieve vendor");
  }
};

const updateVendorById = async (vendorData, vendor_id, orgId) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const params = [...vendorData, vendor_id, orgId];
    const [result] = await tenantPool.query(queries.UPDATE_VENDOR_BY_ID, params);
    return result;
  } catch (error) {
    console.error("❌ Error updating vendor:", error);
    if (error.message === "Organization not found") {
      throw error;
    }
    throw new Error("Failed to update vendor");
  }
};

module.exports = {
  insertVendor,
  getVendorsByOrgId,
  getVendorById,
  updateVendorById,
};