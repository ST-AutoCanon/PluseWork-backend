
const OfficeEmployeeService = require("../services/officeEmployeeService");

const getAllEmployees = async (req, res) => {
  try {
    const orgId = req.user?.orgId || req.query.orgId;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "orgId is required",
      });
    }

    const employees = await OfficeEmployeeService.getAllEmployees(orgId);

    return res.status(200).json({
      success: true,
      count: employees.length,
      data: employees,
    });
  } catch (error) {
    console.error("[officeEmployeeHandler] getAllEmployees error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch employees",
    });
  }
};

const getEmployeesByOfficeLocation = async (req, res) => {
  try {
    const orgId = req.user?.orgId || req.query.orgId;
    const { officeLocationId } = req.params;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "orgId is required",
      });
    }

    const result = await OfficeEmployeeService.getEmployeesByOfficeLocation(
      orgId,
      officeLocationId
    );

    return res.status(200).json({
      success: true,
      office: result.office,
      count: result.employees.length,
      data: result.employees,
    });
  } catch (error) {
    console.error(
      "[officeEmployeeHandler] getEmployeesByOfficeLocation error:",
      error
    );
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch office employees",
    });
  }
};

// NEW
const checkEmployeeAssignments = async (req, res) => {
  try {
    const orgId = req.user?.orgId || req.body.orgId || req.query.orgId;
    const { officeLocationId } = req.params;
    const { employeeIds } = req.body;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "orgId is required",
      });
    }

    const result = await OfficeEmployeeService.checkEmployeeAssignments(
      orgId,
      officeLocationId,
      employeeIds || []
    );

    return res.status(200).json({
      success: true,
      office: result.office,
      requiresConfirmation: result.requiresConfirmation,
      conflictEmployees: result.conflictEmployees || [],
      alreadyMappedEmployees: result.alreadyMappedEmployees || [],
    });
  } catch (error) {
    console.error("[officeEmployeeHandler] checkEmployeeAssignments error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to check employee assignments",
    });
  }
};

const assignEmployeesToOffice = async (req, res) => {
  try {
    const orgId = req.user?.orgId || req.body.orgId;
    const { officeLocationId } = req.params;
    const { employeeIds, forceAssign = false } = req.body;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "orgId is required",
      });
    }

    const result = await OfficeEmployeeService.assignEmployeesToOffice(
      orgId,
      officeLocationId,
      employeeIds,
      forceAssign
    );

    if (result.requiresConfirmation) {
      return res.status(409).json({
        success: false,
        requiresConfirmation: true,
        message:
          "Some employees are already assigned to another office. Do you want to allow assignment to this office as well?",
        office: result.office,
        conflictEmployees: result.conflictEmployees,
        alreadyMappedEmployees: result.alreadyMappedEmployees || [],
      });
    }

    return res.status(200).json({
      success: true,
      message: "Employees assigned successfully",
      office: result.office,
      insertedEmployees: result.insertedEmployees || [],
      alreadyMappedEmployees: result.alreadyMappedEmployees || [],
      count: result.employees.length,
      data: result.employees,
    });
  } catch (error) {
    console.error("[officeEmployeeHandler] assignEmployeesToOffice error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to assign employees to office",
    });
  }
};

const syncOfficeEmployees = async (req, res) => {
  try {
    const orgId = req.user?.orgId || req.body.orgId;
    const { officeLocationId } = req.params;
    const { employeeIds } = req.body;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "orgId is required",
      });
    }

    const result = await OfficeEmployeeService.syncOfficeEmployees(
      orgId,
      officeLocationId,
      employeeIds || []
    );

    return res.status(200).json({
      success: true,
      message: "Office employees updated successfully",
      office: result.office,
      count: result.employees.length,
      data: result.employees,
    });
  } catch (error) {
    console.error("[officeEmployeeHandler] syncOfficeEmployees error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update office employees",
    });
  }
};

const removeEmployeeFromOffice = async (req, res) => {
  try {
    const orgId = req.user?.orgId || req.body.orgId || req.query.orgId;
    const { officeLocationId, employeeId } = req.params;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "orgId is required",
      });
    }

    const result = await OfficeEmployeeService.removeEmployeeFromOffice(
      orgId,
      officeLocationId,
      employeeId
    );

    return res.status(200).json({
      success: true,
      message: "Employee removed from office successfully",
      data: result,
    });
  } catch (error) {
    console.error("[officeEmployeeHandler] removeEmployeeFromOffice error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to remove employee from office",
    });
  }
};

module.exports = {
  getAllEmployees,
  getEmployeesByOfficeLocation,
  checkEmployeeAssignments,   // IMPORTANT
  assignEmployeesToOffice,
  syncOfficeEmployees,
  removeEmployeeFromOffice,
};