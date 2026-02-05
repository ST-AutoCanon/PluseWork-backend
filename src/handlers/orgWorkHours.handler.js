const service = require("../services/orgWorkHours.service");

exports.saveWorkHours = async (req, res) => {
  try {
    const org_id = req.headers["x-org-id"];
    const { work_hours } = req.body;

    if (!org_id || !work_hours) {
      return res.status(400).json({
        message: "org_id and work_hours are required"
      });
    }

    if (work_hours < 1 || work_hours > 24) {
      return res.status(400).json({
        message: "work_hours must be between 1 and 24"
      });
    }

    await service.upsertWorkHours(org_id, work_hours);

    res.json({
      success: true,
      message: "Work hours saved successfully"
    });
  } catch (err) {
    console.error("saveWorkHours error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getWorkHours = async (req, res) => {
  try {
    const org_id = req.headers["x-org-id"];

    const data = await service.getWorkHours(org_id);

    res.json({
      success: true,
      data: data || { org_id, work_hours: 0 }
    });
  } catch (err) {
    console.error("getWorkHours error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
