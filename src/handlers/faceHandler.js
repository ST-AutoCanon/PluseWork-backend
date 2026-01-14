const { saveFaceData, getEmployeeName } = require("../services/faceService");

function getOrgId(req) {
  return (
    req.headers["x-org-id"] ||
    req.headers["x_org_id"] ||
    req.body.org_id ||
    null
  );
}

async function handleSaveFaceData(req, res) {
  try {
    const orgId = getOrgId(req);
    const { employee_id, descriptors } = req.body;

    if (!orgId) {
      return res
        .status(400)
        .json({ success: false, message: "org_id is required" });
    }

    if (!employee_id || !descriptors) {
      return res
        .status(400)
        .json({
          success: false,
          message: "employee_id and descriptors required",
        });
    }

    const first_name = await getEmployeeName(orgId, employee_id);

    if (!first_name) {
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    }

    await saveFaceData(orgId, employee_id, first_name, descriptors);

    res.json({
      success: true,
      message: "Face data saved successfully",
    });
  } catch (err) {
    console.error("handleSaveFaceData error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to save face data",
    });
  }
}

module.exports = {
  handleSaveFaceData,
};
