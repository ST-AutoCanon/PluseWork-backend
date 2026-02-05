module.exports = {
  UPSERT_WORK_HOURS: `
    INSERT INTO org_work_hours (org_id, work_hours)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE work_hours = VALUES(work_hours)
  `,

  GET_WORK_HOURS: `
    SELECT org_id, work_hours 
    FROM org_work_hours 
    WHERE org_id = ?
  `
};
