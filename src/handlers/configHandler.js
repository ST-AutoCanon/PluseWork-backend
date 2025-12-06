const { fetchConfig, saveConfig } = require("../services/configService");

const getConfig = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];
    if (!orgId)
      return res
        .status(400)
        .json({ success: false, message: "x-org-id required" });

    const data = await fetchConfig(orgId);
    res.json({ success: true, data });
  } catch (error) {
    console.error("GET /config error:", error);
    res.status(500).json({ success: false, message: "Database error" });
  }
};

const updateConfig = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];
    if (!orgId)
      return res
        .status(400)
        .json({ success: false, message: "x-org-id required" });

    const { key, value } = req.body;
    if (!key || value === undefined) {
      return res
        .status(400)
        .json({ success: false, message: "key and value required" });
    }

    await saveConfig(key, value, orgId);

    res.json({ success: true, message: "Config updated" });
  } catch (error) {
    console.error("PUT /config error:", error);
    res.status(500).json({ success: false, message: "Failed to save config" });
  }
};

module.exports = { getConfig, updateConfig };
