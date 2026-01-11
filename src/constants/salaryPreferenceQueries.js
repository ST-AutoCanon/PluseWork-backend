
module.exports = {
  GET_SALARY_PREFERENCES: `
    SELECT
      org_id,
      selected_month,
      selected_year,
      selected_template_id
    FROM salary_preferences
    WHERE org_id = ?
    LIMIT 1
  `,

  UPSERT_SALARY_PREFERENCES: `
    INSERT INTO salary_preferences
      (org_id, selected_month, selected_year, selected_template_id)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      selected_month = VALUES(selected_month),
      selected_year = VALUES(selected_year),
      selected_template_id = VALUES(selected_template_id),
      updated_at = CURRENT_TIMESTAMP
  `,
};
