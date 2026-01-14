const {
  getPreferences,
  savePreferences,
  getSelectedTemplateId,
} = require("../services/salaryPreferenceService");

const getPreferencesHandler = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];
    if (!orgId) {
      return res.status(400).json({ error: "Missing x-org-id header" });
    }

    const prefs = await getPreferences(orgId);

    if (!prefs) {
      return res.json({
        selected_month: null,
        selected_year: null,
        selected_template_id: null,
      });
    }

    res.json(prefs);
  } catch (error) {
    console.error("❌ Error fetching salary preferences:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const savePreferencesHandler = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];
    if (!orgId) {
      return res.status(400).json({ error: "Missing x-org-id header" });
    }

    const { selected_month, selected_year, selected_template_id } = req.body;

    if (!selected_month || !selected_year) {
      return res
        .status(400)
        .json({ error: "selected_month and selected_year are required" });
    }

    await savePreferences(orgId, {
      selected_month,
      selected_year,
      selected_template_id,
    });

    res.json({ success: true, message: "Preferences saved successfully" });
  } catch (error) {
    console.error("❌ Error saving salary preferences:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  getPreferencesHandler,
  savePreferencesHandler,
};
