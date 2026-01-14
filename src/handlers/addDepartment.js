const {
  addDepartmentService,
  getDepartmentsService,
} = require("../services/addDepartment");

const path = require("path");

const resolveOrgIdFromReq = (req) => {
  const header =
    req.headers && (req.headers["x-org-id"] || req.headers["x_org_id"]);
  const body = req.body && (req.body.orgId || req.body.org_id);
  const query = req.query && (req.query.orgId || req.query.org_id);
  const userOrg =
    req.user && (req.user.orgId || req.user.Org_id || req.user.org_id);
  return header || body || query || userOrg || null;
};

const addDepartmentHandler = async (req, res) => {
  try {
    const { name } = req.body;
    const orgId = resolveOrgIdFromReq(req);

    if (!name) {
      return res.status(400).json({ message: "Department name is required" });
    }
    if (!orgId) {
      return res.status(400).json({ message: "orgId is required" });
    }

    const icon = req.file ? `/departments/${orgId}/${req.file.filename}` : null;

    await addDepartmentService(name, icon, orgId);

    return res.status(201).json({ message: "Department added successfully" });
  } catch (error) {
    if (error && error.message === "Department already exists") {
      return res.status(409).json({ message: error.message });
    }
    console.error("Error adding department:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getDepartmentsHandler = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) {
      return res.status(400).json({ message: "orgId is required" });
    }

    const departments = await getDepartmentsService(orgId);
    return res.status(200).json({ departments });
  } catch (error) {
    console.error("Error fetching departments:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = {
  addDepartmentHandler,
  getDepartmentsHandler,
};
