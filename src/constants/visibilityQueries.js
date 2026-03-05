// constants/visibilityQueries.js
module.exports = {
  GET_VISIBILITY: `
    SELECT visibility_mode 
    FROM org_project_visibility 
    WHERE org_id = ?
  `,

  UPSERT_VISIBILITY: `
    INSERT INTO org_project_visibility 
      (org_id, visibility_mode, updated_by, created_at, updated_at)
    VALUES (?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      visibility_mode = VALUES(visibility_mode),
      updated_by = VALUES(updated_by),
      updated_at = NOW()
  `,

  // Optional: for admin dashboard later
  GET_ALL_ORG_VISIBILITY: `
    SELECT 
      org_id,
      visibility_mode,
      updated_by,
      updated_at
    FROM org_project_visibility
    ORDER BY updated_at DESC
  `
};