// handlers/checkFaceHandler.js
const { checkFaceExists } = require("../services/checkFaceService");
const ErrorHandler = require("../utils/errorHandler");

const resolveOrgId = (req) =>
  req.headers?.["x-org-id"] ||
  req.headers?.["x_org_id"] ||
  req.query?.orgId ||
  req.query?.org_id ||
  req.body?.orgId ||
  req.body?.org_id ||
  (req.user && (req.user.orgId || req.user.org_id)) ||
  null;

const handleCheckFaceExists = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const orgId = resolveOrgId(req);

    if (!orgId) {
      return res
        .status(400)
        .json(
          ErrorHandler.generateErrorResponse(
            400,
            "Missing orgId (x-org-id header or orgId in body/query)."
          )
        );
    }

    const exists = await checkFaceExists(employee_id, orgId);
    return res.json({ exists });
  } catch (error) {
    console.error("Error checking face data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  handleCheckFaceExists,
};
