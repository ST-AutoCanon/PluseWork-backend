const { AsyncLocalStorage } = require("async_hooks");

const als = new AsyncLocalStorage();

function getOrgIdFromReq(req) {
  if (!req || typeof req !== "object") return null;
  return (
    req.headers?.["x-org-id"] ||
    req.headers?.["org-id"] ||
    req.headers?.["org_id"] ||
    req.query?.orgId ||
    req.query?.org_id ||
    req.body?.orgId ||
    req.body?.org_id ||
    null
  );
}

function runWithOrgId(orgId, callback) {
  if (!orgId) return callback();
  return als.run({ orgId }, callback);
}

function getOrgId() {
  const store = als.getStore();
  return store && store.orgId ? store.orgId : null;
}

module.exports = {
  runWithOrgId,
  getOrgId,
  getOrgIdFromReq,
};
