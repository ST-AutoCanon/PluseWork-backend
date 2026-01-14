const { fetchConfig, saveConfig } = require("../services/configService");

const getOrgIdFromHeaders = (req) => {
  return (
    req.headers["x-org-id"] ||
    req.headers["x_org_id"] ||
    req.headers["org-id"] ||
    req.headers["orgid"] ||
    null
  );
};

const getConfig = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "Missing required header: x-org-id",
      });
    }

    const data = await fetchConfig(orgId);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("GET /config error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch config",
      error: error.message,
    });
  }
};

const updateConfig = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "Missing required header: x-org-id",
      });
    }

    const { key, value } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({
        success: false,
        message: "Both 'key' and 'value' are required in request body",
      });
    }

    await saveConfig(key, value, orgId);

    res.json({
      success: true,
      message: "Config updated successfully",
      updated: { [key]: value },
    });
  } catch (error) {
    console.error("PUT /config error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to save config",
      error: error.message,
    });
  }
};

module.exports = { getConfig, updateConfig };
