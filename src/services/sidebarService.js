const db = require("../config");
const queries = require("../constants/sidebarQueries");

exports.fetchSidebarMenuByOrgAndRole = async (orgId, role) => {
  const roleString = `${orgId}:${role}`;
  const [rows] = await db.execute(queries.GET_SIDEBAR_MENU_BY_ORG_ROLE, [
    roleString,
  ]);
  return rows;
};
