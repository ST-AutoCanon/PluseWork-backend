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

// Add compensation record

const addCompensationHandler = async (req, res) => {
  try {
    const { compensationPlanName, formData } = req.body;

    if (!compensationPlanName || typeof formData !== "object") {
      return res
        .status(400)
        .json({ error: "Missing compensationPlanName or invalid formData" });
    }

    const result = await addCompensation({ compensationPlanName, formData });

    res.status(201).json({
      success: true,
      message: "Compensation plan added successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error adding compensation plan:", error);
    res.status(500).json({
      error: "Failed to add compensation plan",
      details: error.message,
    });
  }
};
// Get all compensation records
const getAllCompensationsHandler = async (req, res) => {
  try {
    const compensations = await getAllCompensations();
    res.status(200).json({ success: true, data: compensations });
  } catch (error) {
    console.error("Error fetching compensations:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch compensations", details: error.message });
  }
};

// Get compensation by employee ID
const getCompensationByEmployeeIdHandler = async (req, res) => {
  try {
    const { id } = req.params; // Changed from employeeId to id

    if (!id) {
      return res.status(400).json({ error: "Missing ID" });
    }
    const result = await getCompensationByEmployeeId(id);
    if (!result.length) {
      return res.status(404).json({ message: "Compensation not found" });
    }
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Error fetching compensation by ID:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch compensation", details: error.message });
  }
};

// Update compensation
// handlers/compensationHandler.js
const updateCompensationHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { compensationPlanName, formData } = req.body;

    if (!id || !compensationPlanName || typeof formData !== "object") {
      return res.status(400).json({
        error: "Missing id, compensationPlanName, or invalid formData",
      });
    }

    const result = await updateCompensation(id, {
      compensationPlanName,
      formData,
    });

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Compensation not found for update" });
    }

    res
      .status(200)
      .json({ success: true, message: "Compensation updated successfully" });
  } catch (error) {
    console.error("Error updating compensation:", error);
    res
      .status(500)
      .json({ error: "Failed to update compensation", details: error.message });
  }
};

// Delete compensation
const deleteCompensationHandler = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const result = await deleteCompensation(employeeId);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Compensation not found for deletion" });
    }

    res
      .status(200)
      .json({ success: true, message: "Compensation deleted successfully" });
  } catch (error) {
    console.error("Error deleting compensation:", error);
    res
      .status(500)
      .json({ error: "Failed to delete compensation", details: error.message });
  }
};
const getAllEmployeeNamesHandler = async (req, res) => {
  try {
    const employeeNames = await getAllEmployeeNames();
    res.status(200).json({ success: true, data: employeeNames });
  } catch (error) {
    console.error("Error fetching employee names:", error);
    res.status(500).json({
      error: "Failed to fetch employee names",
      details: error.message,
    });
  }
};
const getAllDepartmentNamesHandler = async (req, res) => {
  try {
    const departmentNames = await getAllDepartmentNames();
    res.status(200).json({ success: true, data: departmentNames });
  } catch (error) {
    console.error("Error fetching department names:", error);
    res.status(500).json({
      error: "Failed to fetch department names",
      details: error.message,
    });
  }
};

const handleGetEmployeesByDepartmentId = async (req, res) => {
  const { departmentId } = req.params;
  try {
    const employees = await getEmployeesByDepartmentId(departmentId);
    res.status(200).json(employees);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch employees by department" });
  }
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
