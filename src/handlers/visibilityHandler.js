// handlers/visibilityHandler.js
const visibilityService = require("../services/visibilityService");

// ✅ Local helper function
function resolveOrgIdFromReq(req) {
  const header =
    req.headers?.["x-org-id"] ||
    req.headers?.["x_org_id"];

  const body =
    req.body?.orgId ||
    req.body?.org_id;

  const query =
    req.query?.orgId ||
    req.query?.org_id;

  return header || body || query || null;
}

exports.getProjectVisibility = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) {
      return res.status(400).json({ error: "orgId is required (header or query)" });
    }

    const mode = await visibilityService.getProjectVisibility(orgId);

    return res.status(200).json({
      success: true,
      visibility_mode: mode,
    });
  } catch (err) {
    console.error("getProjectVisibility error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateProjectVisibility = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) {
      return res.status(400).json({ error: "orgId is required" });
    }

    const { visibility_mode } = req.body;
    if (!visibility_mode) {
      return res.status(400).json({ error: "visibility_mode is required" });
    }

    const updatedBy = req.user?.employeeId || req.user?.email || "system";

    await visibilityService.setProjectVisibility(orgId, visibility_mode, updatedBy);

    return res.status(200).json({
      success: true,
      message: "Project visibility updated successfully",
      visibility_mode,
    });
  } catch (err) {
    console.error("updateProjectVisibility error:", err);
    return res.status(400).json({ error: err.message || "Failed to update" });
  }
};