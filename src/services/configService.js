const db = require("../config");
const { GET_CONFIG_QUERY } = require("../constants/configQueries");

const fetchConfig = async (orgId) => {
  const [rows] = await db.query(GET_CONFIG_QUERY, [orgId]);
  const config = {};
  rows.forEach((r) => {
    config[r.key] = r.value;
  });
  return config;
};

const saveConfig = async (key, value, orgId) => {
  const UPSERT = `
    INSERT INTO config (\`key\`, value, org_id)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE value = VALUES(value)
  `;
  await db.query(UPSERT, [key, value, orgId]);
};

module.exports = { fetchConfig, saveConfig };
