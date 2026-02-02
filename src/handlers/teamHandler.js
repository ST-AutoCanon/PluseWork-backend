const { getTeamMembersService } = require("../services/teamService");

const getTeamMembers = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];
    const supervisorId = req.headers["x-employee-id"];

    if (!orgId || !supervisorId) {
      return res.status(400).json({ success: false, error: "Missing required headers" });
    }

    const members = await getTeamMembersService(supervisorId, orgId);

    res.json({
      success: true,
      count: members.length,
      members
    });
  } catch (err) {
    console.error("getTeamMembers error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { getTeamMembers };