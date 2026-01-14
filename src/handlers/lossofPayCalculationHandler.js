const {
  getCurrentMonthLOP,
  getDeferredLOP,
  getNextMonthLOP,
} = require("../services/lossofPayCalculationService");

const getOrgId = (req) =>
  req.headers["x-org-id"] ||
  req.headers["org-id"] ||
  req.headers.org_id ||
  null;

const handleGetCurrentMonthLOP = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(400).json({ success: false, error: "orgId required" });
    }

    const data = await getCurrentMonthLOP(orgId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("❌ CURRENT MONTH LOP ERROR:", error.message);
    console.error(error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
};

const handleGetDeferredLOP = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(400).json({ success: false, error: "orgId required" });
    }

    const data = await getDeferredLOP(orgId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("❌ DEFERRED LOP ERROR:", error.message);
    console.error(error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
};

const handleGetNextMonthLOP = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(400).json({ success: false, error: "orgId required" });
    }

    const data = await getNextMonthLOP(orgId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("❌ NEXT MONTH LOP ERROR:", error.message);
    console.error(error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
};

module.exports = {
  handleGetCurrentMonthLOP,
  handleGetDeferredLOP,
  handleGetNextMonthLOP,
};
