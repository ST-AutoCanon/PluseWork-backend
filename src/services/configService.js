
const { GET_CONFIG_QUERY } = require("../constants/configQueries");
const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");

/**
 * Fetch all config key-value pairs for the organization (tenant DB)
 */
const fetchConfig = async (orgId) => {
  if (!orgId) throw new Error("orgId is required");

  const tenantDb = await getTenantPoolByOrgId(orgId);
  const [rows] = await tenantDb.query(GET_CONFIG_QUERY, [orgId]);

  const config = {};
  rows.forEach((r) => {
    config[r.key] = r.value;
  });

  return config;
};

/**
 * Upsert a single config value for the organization (tenant DB)
 */
const saveConfig = async (key, value, orgId) => {
  if (!orgId) throw new Error("orgId is required");
  if (!key || value === undefined)
    throw new Error("key and value are required");

  const tenantDb = await getTenantPoolByOrgId(orgId);

  const UPSERT = `
    INSERT INTO config (\`key\`, value, org_id)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE value = VALUES(value)
  `;

  await tenantDb.query(UPSERT, [key, value, orgId]);
};

module.exports = { fetchConfig, saveConfig };
