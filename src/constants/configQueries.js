


module.exports = {
  GET_CONFIG_QUERY: `
    SELECT \`key\`, \`value\`
    FROM config
    WHERE org_id IS NULL OR org_id = ?
    ORDER BY org_id DESC
  `,
};