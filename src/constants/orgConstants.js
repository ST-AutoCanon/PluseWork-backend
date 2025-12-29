const GET_ORG_NAME_BY_ID = `
  SELECT subdomain FROM organizations WHERE id = ?;
`;

module.exports = {
  GET_ORG_NAME_BY_ID,
};
