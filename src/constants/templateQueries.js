module.exports = {
  INSERT_TEMPLATE: `INSERT INTO templates
  (organization_id, name, template_type, grapes_json, html, css, thumbnail_url, meta, layout, version, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,

  UPDATE_TEMPLATE: `UPDATE templates SET grapes_json = ?, html = ?, css = ?, meta = ?, layout = ?, version = version + 1, updated_at = NOW() WHERE id = ? AND organization_id = ?;`,

  INSERT_TEMPLATE_VERSION: `INSERT INTO template_versions (template_id, grapes_json, html, css, layout, version_num, created_by) VALUES (?, ?, ?, ?, ?, ?, ?);`,

  GET_TEMPLATES_BY_ORG: `SELECT * FROM templates WHERE organization_id = ? ORDER BY created_at DESC;`,

  GET_TEMPLATE_BY_ID: `SELECT * FROM templates WHERE id = ? AND organization_id = ?;`,

  DELETE_TEMPLATE: `
  DELETE FROM templates
  WHERE id = ? AND organization_id = ?;
`,
};
