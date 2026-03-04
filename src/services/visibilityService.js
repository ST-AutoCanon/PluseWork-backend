const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const queries = require("../constants/visibilityQueries");

async function getProjectVisibility(orgId) {
  if (!orgId) {
    throw new Error("orgId is required");
  }

  const tenantPool = await getTenantPoolByOrgId(orgId);
  const [rows] = await tenantPool.query(queries.GET_VISIBILITY, [orgId]);

  return rows.length > 0 ? rows[0].visibility_mode : "assigned_only";
}

async function setProjectVisibility(orgId, mode, updatedBy = null) {
  if (!orgId) throw new Error("orgId is required");

  if (!["all", "assigned_only"].includes(mode)) {
    throw new Error("Invalid visibility mode. Allowed: 'all', 'assigned_only'");
  }

  const tenantPool = await getTenantPoolByOrgId(orgId);
  await tenantPool.query(queries.UPSERT_VISIBILITY, [
    orgId,
    mode,
    updatedBy || "system",
  ]);
}

module.exports = {
  getProjectVisibility,
  setProjectVisibility,
};