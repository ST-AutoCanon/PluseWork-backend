const GET_ORG_NAME_BY_ID = `
  SELECT Name FROM Organizations WHERE id = ?;
`;

module.exports = {
  GET_ORG_NAME_BY_ID,
};
