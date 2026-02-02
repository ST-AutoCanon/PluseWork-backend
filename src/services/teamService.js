const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const TEAM_QUERIES = require("../constants/teamQueries");

const getTeamMembersService = async (supervisorId, orgId) => {
  if (!orgId) throw new Error("orgId is required");

  const pool = await getTenantPoolByOrgId(orgId);

  const [rows] = await pool.query(TEAM_QUERIES.GET_TEAM_MEMBERS, [supervisorId]);

  // Optional: format/minimize response if needed
  return rows.map(row => ({
    employee_id: row.employee_id,
    employee_name: row.employee_name,
    level: row.level,
    status: row.status,
    photo_url: row.photo_url || null
  }));
};

module.exports = { getTeamMembersService };