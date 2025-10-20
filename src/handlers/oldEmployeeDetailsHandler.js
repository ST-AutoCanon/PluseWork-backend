const service = require("../services/oldEmployeeDetailsService");
const ErrorHandler = require("../utils/errorHandler");

const saveOldEmployeeDetails = async (req, res) => {
  try {
    const orgId =
      req.headers["x-org-id"] ||
      req.headers["x-organization-id"] ||
      (req.body && req.body.orgId) ||
      null;
    console.log("Received req.body in handler:", req.body);

    const result = await service.insertOldEmployeeDetails(req.body, orgId);
    res.status(201).json({
      message: "Employee details saved successfully",
      insertId: result.insertId,
    });
  } catch (error) {
    console.error("Save Error:", error);
    res.status(500).json({
      message: "Failed to save employee details",
      error: error.message || "Unknown error",
    });
  }
};

const fetchOldEmployeeDetails = async (req, res) => {
  try {
    const orgId =
      req.headers["x-org-id"] ||
      req.headers["x-organization-id"] ||
      (req.body && req.body.orgId) ||
      null;
    const data = await service.getAllOldEmployeeDetails(orgId);
    res.status(200).json(data);
  } catch (error) {
    console.error("Fetch Error:", error);
    res.status(500).json({
      message: "Failed to fetch employee details",
      error: error.message || "Unknown error",
    });
  }
};

const editOldEmployeeDetails = async (req, res) => {
  try {
    const orgId =
      req.headers["x-org-id"] ||
      req.headers["x-organization-id"] ||
      (req.body && req.body.orgId) ||
      null;
    const result = await service.updateOldEmployeeDetails(req.body, orgId);
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Employee not found or no changes made" });
    }
    res.status(200).json({ message: "Employee details updated successfully" });
  } catch (error) {
    console.error("Edit Error:", error);
    res.status(500).json({
      message: "Failed to update employee details",
      error: error.message || "Unknown error",
    });
  }
};

const getEmployeeDetails = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"] || req.query.orgId;
    if (!orgId) {
      return res
        .status(400)
        .json(
          ErrorHandler.generateErrorResponse(400, "Missing org id (x-org-id)")
        );
    }

    const employees = await service.fetchEmployeeDetails(orgId);

    return res
      .status(200)
      .json(ErrorHandler.generateSuccessResponse(200, { data: employees }));
  } catch (error) {
    console.error("Error fetching employees:", error);

    return res
      .status(500)
      .json(
        ErrorHandler.generateErrorResponse(500, "Failed to fetch employees")
      );
  }
};

module.exports = {
  saveOldEmployeeDetails,
  fetchOldEmployeeDetails,
  editOldEmployeeDetails,
  getEmployeeDetails,
};
