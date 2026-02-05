const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const queries = require("../constants/orgWorkHours.constants");

exports.upsertWorkHours = async (org_id, work_hours) => {
  const pool = await getTenantPoolByOrgId(org_id);
  await pool.query(queries.UPSERT_WORK_HOURS, [org_id, work_hours]);
};

exports.getWorkHours = async (org_id) => {
  const pool = await getTenantPoolByOrgId(org_id);
  const [rows] = await pool.query(queries.GET_WORK_HOURS, [org_id]);
  return rows[0];
};
