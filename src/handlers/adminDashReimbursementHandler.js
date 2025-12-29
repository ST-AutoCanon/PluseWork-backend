const {
  getApprovedReimbursementLastMonth,
} = require("../services/adminDashReimbursement");

const extractOrgId = (req) =>
  req.headers["x-org-id"] ||
  req.query.orgId ||
  (req.user && (req.user.orgId || req.user.Org_id || req.user.orgId));

const handleGetApprovedReimbursementLastMonth = async (req, res) => {
  try {
    const orgId = extractOrgId(req);
    if (!orgId) {
      return res.status(400).json({ error: "orgId is required" });
    }

    const totalApprovedReimbursement = await getApprovedReimbursementLastMonth(
      orgId
    );
    res.status(200).json({ totalApprovedReimbursement });
  } catch (error) {
    console.error("Error fetching approved reimbursement:", error);
    const message =
      error && error.code === "TENANT_SCHEMA"
        ? "Tenant schema not provisioned or inaccessible"
        : "Internal Server Error";
    res.status(500).json({ error: message });
  }
};

module.exports = {
  handleGetApprovedReimbursementLastMonth,
};
