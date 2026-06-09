const attendanceService = require("../services/attendanceService");

function resolveOrgId(req) {
  return (
    req.orgId ||
    req.headers?.["x-org-id"] ||
    req.query?.orgId ||
    req.query?.org_id ||
    req.body?.orgId ||
    req.body?.org_id ||
    (req.user && (req.user.orgId || req.user.org_id)) ||
    null
  );
}

async function getLoginHoursConfigHandler(req, res) {
  try {
    const orgId = resolveOrgId(req);
    if (!orgId) {
      return res
        .status(400)
        .json({ success: false, message: "orgId is required" });
    }

    const cfg = await attendanceService.getLoginHoursConfig(orgId);
    return res.status(200).json({ success: true, data: cfg });
  } catch (err) {
    console.error("[GET_LOGIN_HOURS_CONFIG] Error:", err?.message || err);
    return res
      .status(500)
      .json({ success: false, message: err?.message || "Internal error" });
  }
}

async function upsertLoginHoursConfigHandler(req, res) {
  try {
    const orgId = resolveOrgId(req);
    if (!orgId) {
      return res
        .status(400)
        .json({ success: false, message: "orgId is required" });
    }

    const config = req.body || {};
    await attendanceService.upsertLoginHoursConfig(orgId, config);
    const cfg = await attendanceService.getLoginHoursConfig(orgId);
    return res.status(200).json({ success: true, data: cfg });
  } catch (err) {
    console.error("[UPSERT_LOGIN_HOURS_CONFIG] Error:", err?.message || err);
    return res
      .status(500)
      .json({ success: false, message: err?.message || "Internal error" });
  }
}

module.exports = {
  getLoginHoursConfigHandler,
  upsertLoginHoursConfigHandler,
};
