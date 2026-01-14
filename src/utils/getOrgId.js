module.exports.getOrgId = (req) => {
  return (
    req.headers["x-org-id"] ||
    req.headers["x-organization-id"] ||
    req.headers["x-orgid"] ||
    (req.body && req.body.orgId) ||
    null
  );
};
