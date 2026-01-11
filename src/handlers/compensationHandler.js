const {
  addCompensation,
  getAllCompensations,
  getCompensationByEmployeeId,
  updateCompensation,
  deleteCompensation,
  getAllEmployeeNames,
  getAllDepartmentNames,
  getEmployeesByDepartmentId,
} = require("../services/compensationService");

/**
 * Unified org_id resolver (same pattern as assets)
 */
const getOrgIdFromRequest = (req) =>
  req.headers["x-org-id"] ||
  req.headers["org-id"] ||
  req.headers["org_id"] ||
  req.query.org_id ||
  null;

/**
 * ADD COMPENSATION
 */
const addCompensationHandler = async (req, res) => {
  const orgId = getOrgIdFromRequest(req);
  if (!orgId) {
    return res.status(400).json({ error: "org_id is required" });
  }

  try {
    const { compensationPlanName, formData } = req.body;

    if (!compensationPlanName || typeof formData !== "object") {
      return res.status(400).json({
        error: "Missing compensationPlanName or invalid formData",
      });
    }

    const result = await addCompensation(orgId, {
      compensationPlanName,
      formData,
    });

    res.status(201).json({
      success: true,
      message: "Compensation plan added successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error adding compensation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add compensation plan",
    });
  }
};

/**
 * LIST COMPENSATIONS
 */
const getAllCompensationsHandler = async (req, res) => {
  try {
    const orgId = getOrgIdFromRequest(req);
    if (!orgId) {
      return res.status(400).json({ error: "org_id is required" });
    }

    const data = await getAllCompensations(orgId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("GET COMPENSATIONS ERROR:", error);
    res.status(500).json({ error: "Failed to fetch compensations" });
  }
};

/**
 * GET BY EMPLOYEE ID
 */
const getCompensationByEmployeeIdHandler = async (req, res) => {
  const orgId = getOrgIdFromRequest(req);
  const { id } = req.params;

  if (!orgId || !id) {
    return res.status(400).json({ error: "Missing org_id or employee id" });
  }

  try {
    const data = await getCompensationByEmployeeId(orgId, id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching compensation:", error);
    res.status(500).json({ error: "Failed to fetch compensation" });
  }
};

/**
 * UPDATE COMPENSATION
 */
const updateCompensationHandler = async (req, res) => {
  const orgId = getOrgIdFromRequest(req);
  const { id } = req.params;

  if (!orgId || !id) {
    return res.status(400).json({ error: "Missing org_id or id" });
  }

  try {
    const { compensationPlanName, formData } = req.body;

    await updateCompensation(orgId, id, {
      compensationPlanName,
      formData,
    });

    res.status(200).json({
      success: true,
      message: "Compensation updated successfully",
    });
  } catch (error) {
    console.error("Error updating compensation:", error);
    res.status(500).json({ error: "Failed to update compensation" });
  }
};

/**
 * DELETE COMPENSATION
 */
const deleteCompensationHandler = async (req, res) => {
  const orgId = getOrgIdFromRequest(req);
  const { id } = req.params;

  if (!orgId || !id) {
    return res.status(400).json({ error: "Missing org_id or id" });
  }

  try {
    await deleteCompensation(orgId, id);
    res.status(200).json({
      success: true,
      message: "Compensation deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting compensation:", error);
    res.status(500).json({ error: "Failed to delete compensation" });
  }
};

/**
 * EMPLOYEE NAMES
 */
const getAllEmployeeNamesHandler = async (req, res) => {
  const orgId = getOrgIdFromRequest(req);
  if (!orgId) {
    return res.status(400).json({ error: "org_id is required" });
  }

  const data = await getAllEmployeeNames(orgId);
  res.status(200).json({ success: true, data });
};

/**
 * DEPARTMENT NAMES
 */
const getAllDepartmentNamesHandler = async (req, res) => {
  const data = await getAllDepartmentNames();
  res.status(200).json({ success: true, data });
};

/**
 * EMPLOYEES BY DEPARTMENT
 */
const handleGetEmployeesByDepartmentId = async (req, res) => {
  const orgId = getOrgIdFromRequest(req);
  const { departmentId } = req.params;

  if (!orgId) {
    return res.status(400).json({ error: "org_id is required" });
  }

  const data = await getEmployeesByDepartmentId(orgId, departmentId);
  res.status(200).json({ success: true, data });
};

module.exports = {
  addCompensationHandler,
  getAllCompensationsHandler,
  getCompensationByEmployeeIdHandler,
  updateCompensationHandler,
  deleteCompensationHandler,
  getAllEmployeeNamesHandler,
  getAllDepartmentNamesHandler,
  handleGetEmployeesByDepartmentId,
};
