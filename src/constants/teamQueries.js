// constants/teamQueries.js
const TEAM_QUERIES = {
  GET_TEAM_MEMBERS: `
    WITH RECURSIVE employee_tree AS (
      -- Anchor: direct reports
      SELECT 
        employee_id,
        supervisor_id,
        1 AS level
      FROM employee_professional
      WHERE supervisor_id = ?
        COLLATE utf8mb4_0900_ai_ci

      UNION ALL

      -- Recursive: indirect reports
      SELECT 
        ep.employee_id,
        ep.supervisor_id,
        et.level + 1
      FROM employee_professional ep
      INNER JOIN employee_tree et 
        ON ep.supervisor_id = et.employee_id COLLATE utf8mb4_0900_ai_ci
    )
    SELECT 
      et.employee_id,
      et.level,
      CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
      e.status,
      ep.photo_url
    FROM employee_tree et
    JOIN employees e 
      ON e.employee_id = et.employee_id COLLATE utf8mb4_0900_ai_ci
    LEFT JOIN employee_personal ep 
      ON e.employee_id = ep.employee_id
    WHERE e.status = 'Active'
    ORDER BY et.level ASC, employee_name ASC;
  `
};

module.exports = TEAM_QUERIES;