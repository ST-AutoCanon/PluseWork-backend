const db = require("../config");
const { getOrgId, getOrgIdFromReq } = require("./requestContext");
const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");

async function getDbPool(req = null) {
  const orgId = getOrgId() || getOrgIdFromReq(req);
  if (!orgId) return db;
  try {
    return await getTenantPoolByOrgId(orgId);
  } catch (err) {
    console.error(
      "[tenantDb] failed to resolve tenant DB for orgId",
      orgId,
      err,
    );
    throw err;
  }
}

module.exports = {
  getDbPool,
};
