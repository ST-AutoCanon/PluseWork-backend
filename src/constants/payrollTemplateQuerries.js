const GET_SALARY_PREFERENCES = `
  SELECT selected_template_id
  FROM salary_preferences
  WHERE org_id = ?
  LIMIT 1;
`;

const GET_TEMPLATE_BY_ID = `
  SELECT id, html, css, meta, name, thumbnail_url
  FROM templates
  WHERE id = ?
    AND organization_id = ?
  LIMIT 1;
`;

module.exports = {
  GET_SALARY_PREFERENCES,
  GET_TEMPLATE_BY_ID,
};
