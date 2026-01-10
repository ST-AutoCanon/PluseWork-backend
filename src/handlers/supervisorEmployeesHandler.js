

const { getEmployeesBySupervisorService } = require("../services/supervisorEmployeesService");

// Extract orgId from headers
const getOrgIdFromHeaders = (req) => {
  return (
    req.headers["x-org-id"] ||
    req.headers["x_org_id"] ||
    req.headers["org-id"] ||
    req.headers["orgid"] ||
    null
  );
};

const getEmployeesBySupervisorHandler = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    const supervisorId = req.headers["x-employee-id"];

    if (!orgId) return res.status(400).json({ error: "x-org-id header is required" });
    if (!supervisorId) return res.status(400).json({ error: "Supervisor ID is required in headers" });

    const employees = await getEmployeesBySupervisorService(supervisorId, orgId);
    res.json({ supervisorId, employees });
  } catch (error) {
    console.error("Handler error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getEmployeesBySupervisorHandler };
