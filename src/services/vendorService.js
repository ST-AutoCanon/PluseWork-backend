const db = require("../config");
const queries = require("../constants/vendorQueries");

const insertVendor = async (vendorData, orgId) => {
  try {
    const params = [orgId, ...vendorData];
    const [result] = await db.query(queries.INSERT_VENDOR, params);
    return result;
  } catch (error) {
    console.error("Error inserting vendor:", error);
    throw new Error("Error inserting vendor");
  }
};

const getVendorsByOrgId = async (orgId) => {
  try {
    const [rows] = await db.query(queries.GET_VENDORS_BY_ORGID, [orgId]);
    return rows;
  } catch (error) {
    console.error("Error fetching vendors by orgId:", error);
    throw new Error("Error fetching vendors");
  }
};

const getVendorById = async (vendor_id, orgId) => {
  try {
    const [rows] = await db.query(queries.GET_VENDOR_BY_ID, [vendor_id, orgId]);
    return rows && rows.length ? rows[0] : null;
  } catch (error) {
    console.error("Error fetching vendor by id:", error);
    throw new Error("Error fetching vendor");
  }
};

const updateVendorById = async (vendorData, vendor_id, orgId) => {
  try {
    const params = [...vendorData, vendor_id, orgId];
    const [result] = await db.query(queries.UPDATE_VENDOR_BY_ID, params);
    return result;
  } catch (error) {
    console.error("Error updating vendor:", error);
    throw new Error("Error updating vendor");
  }
};

module.exports = {
  insertVendor,
  getVendorsByOrgId,
  getVendorById,
  updateVendorById,
};
