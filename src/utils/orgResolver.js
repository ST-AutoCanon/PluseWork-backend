function resolveOrgIdFromReq(req) {
  const header =
    req.headers && (req.headers["x-org-id"] || req.headers["x_org_id"]);
  const body = req.body && (req.body.orgId || req.body.org_id);
  const query = req.query && (req.query.orgId || req.query.org_id);

  return header || body || query || null;
}

module.exports = resolveOrgIdFromReq;