const orgService = require("../services/orgService");

exports.handleGetOrgNameById = async (req, res) => {
  try {
    const orgId = req.params.id;
    const org = await orgService.getOrgNameById(orgId);

    if (!org) return res.status(404).json({ message: "Organization not found." });

    res.status(200).json(org);
  } catch (error) {
    console.error("Error in handleGetOrgNameById:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
