const db = require("../config");
const { GET_ORG_NAME_BY_ID } = require("../constants/orgConstants");

exports.getOrgNameById = async (orgId) => {
  const [rows] = await db.execute(GET_ORG_NAME_BY_ID, [orgId]);
  return rows[0];
};
