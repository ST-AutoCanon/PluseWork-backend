const {
  checkEmployeeAssignment,
  assignCompensation,
  getAssignedCompensationDetails,
  addEmployeeBonus,
  addEmployeeBonusBulk,
  getEmployeeBonusDetails,
  addEmployeeAdvance,
  getEmployeeAdvanceDetails,
  getEmployeeExtraHoursService,
  addOvertimeDetailsBulk,
  approveOvertimeRow,
  rejectOvertimeRow,
  getAllOvertimeDetails,
  getEmployeeLopDetailsForCurrentPeriod,
} = require("../services/assign_compensations");

async function checkEmployeeAssignmentHandler(req, res) {
  try {
    const { employeeId } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: employeeId",
      });
    }

    const result = await checkEmployeeAssignment(employeeId);

    res.status(200).json({
      success: true,
      message: result.hasAssignment
        ? `Employee ${employeeId} has existing assignments`
        : `No assignments found for employee ${employeeId}`,
      data: result,
    });
  } catch (error) {
    console.error("❌ Error checking employee assignment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check employee assignment",
      details: error.message,
    });
  }
}

async function assignCompensationHandler(req, res) {
  try {
    const {
      compensationPlanName,
      employeeId = [],
      departmentIds = [],
      assignedBy,
      assignedDate,
    } = req.body;

    if (
      !compensationPlanName ||
      (!employeeId.length && !departmentIds.length) ||
      !assignedBy
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: compensationPlanName, assignedBy, and at least one employeeId or departmentIds",
      });
    }

    const result = await assignCompensation({
      employeeId,
      departmentIds,
      compensationPlanName,
      assignedBy,
      assignedDate,
    });

    res.status(201).json({
      success: true,
      message: `Compensation plan ${compensationPlanName} assigned successfully`,
      data: result,
    });
  } catch (error) {
    console.error("❌ Error assigning compensation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to assign compensation",
      details: error.message,
    });
  }
}

const getAssignedCompensationDetailsHandler = async (req, res) => {
  try {
    const data = await getAssignedCompensationDetails();

    res.status(200).json({
      success: true,
      message: data.length
        ? "Assigned compensation data retrieved successfully"
        : "No assigned compensations found",
      data,
    });
  } catch (error) {
    console.error("❌ Error fetching assigned compensation details:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch assigned compensation details",
      details: error.message,
    });
  }
};
const addEmployeeBonusHandler = async (req, res) => {
  try {
    const {
      percentageCtc = null,
      percentageMonthlySalary = null,
      fixedAmount = null,
      applicableMonth,
    } = req.body;

    if (!applicableMonth) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: applicableMonth",
      });
    }

    const result = await addEmployeeBonus({
      percentageCtc,
      percentageMonthlySalary,
      fixedAmount,
      applicableMonth,
    });

    res.status(201).json({
      success: true,
      message: "Bonus added successfully",
      data: result,
    });
  } catch (error) {
    console.error("❌ Error adding bonus:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add bonus",
      details: error.message,
    });
  }
};

const addEmployeeBonusBulkHandler = async (req, res) => {
  try {
    const {
      percentageCtc = null,
      percentageMonthlySalary = null,
      fixedAmount = null,
      applicableMonth,
    } = req.body;

    if (!applicableMonth) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: applicableMonth",
      });
    }

    if (
      percentageCtc === null &&
      percentageMonthlySalary === null &&
      fixedAmount === null
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Please provide at least one bonus value (CTC%, Monthly Salary%, or Fixed Amount)",
      });
    }

    if (percentageCtc !== null && (percentageCtc < 0 || percentageCtc > 100)) {
      return res.status(400).json({
        success: false,
        error: "Invalid percentageCtc: must be between 0 and 100",
      });
    }
    if (
      percentageMonthlySalary !== null &&
      (percentageMonthlySalary < 0 || percentageMonthlySalary > 100)
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid percentageMonthlySalary: must be between 0 and 100",
      });
    }

    const result = await addEmployeeBonusBulk({
      percentageCtc,
      percentageMonthlySalary,
      fixedAmount,
      applicableMonth,
    });

    res.status(201).json({
      success: true,
      message: `Bonus added successfully for ${applicableMonth}`,
      data: result,
    });
  } catch (error) {
    console.error("❌ Error adding bulk bonus:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add bonus",
      details: error.message,
    });
  }
};

const getEmployeeBonusDetailsHandler = async (req, res) => {
  try {
    const data = await getEmployeeBonusDetails();

    res.status(200).json({
      success: true,
      message: "Bonus details retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("❌ Error fetching bonus details:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch bonus details",
      details: error.message,
    });
  }
};

const addEmployeeAdvanceHandler = async (req, res) => {
  try {
    const { employeeId, advanceAmount, recoveryMonths, applicableMonth } =
      req.body;

    const applicableMonths = applicableMonth;

    if (
      !employeeId ||
      !advanceAmount ||
      advanceAmount <= 0 ||
      !recoveryMonths ||
      recoveryMonths <= 0 ||
      !applicableMonths
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Missing or invalid required fields: employeeId, advanceAmount, recoveryMonths, or applicableMonths",
      });
    }

    const result = await addEmployeeAdvance({
      employeeId,
      advanceAmount,
      recoveryMonths,
      applicableMonths,
    });

    res.status(201).json({
      success: true,
      message: `Advance of ₹${advanceAmount} added successfully for employee ${employeeId}`,
      data: result,
    });
  } catch (error) {
    console.error("❌ Error adding advance:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add advance",
      details: error.message,
    });
  }
};

const getEmployeeAdvanceDetailsHandler = async (req, res) => {
  try {
    const data = await getEmployeeAdvanceDetails();

    res.status(200).json({
      success: true,
      message: "Advance details retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("❌ Error fetching advance details:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch advance details",
      details: error.message,
    });
  }
};

const fetchEmployeeExtraHours = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: "Missing required query parameters: startDate and endDate",
      });
    }

    const data = await getEmployeeExtraHoursService(startDate, endDate);
    res.status(200).json({
      success: true,
      message: "Extra hours retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("Error fetching employee extra hours:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch extra hours data",
      details: error.message,
    });
  }
};

const handleAddOvertimeDetailsBulk = async (req, res) => {
  try {
    const dataArray = req.body.data;
    const result = await addOvertimeDetailsBulk(dataArray);
    res.status(200).json({
      success: true,
      message: "Overtime details added successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in handleAddOvertimeDetailsBulk:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add overtime details",
      details: error.message,
    });
  }
};

const handleApproveOvertimeRow = async (req, res) => {
  try {
    const row = req.body;
    const result = await approveOvertimeRow(row);
    res.status(200).json({
      success: true,
      message: "Overtime approved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in handleApproveOvertimeRow:", error);
    res.status(500).json({
      success: false,
      error: "Failed to approve overtime",
      details: error.message,
    });
  }
};

const handleRejectOvertimeRow = async (req, res) => {
  try {
    const row = req.body;
    const result = await rejectOvertimeRow(row);
    res.status(200).json({
      success: true,
      message: "Overtime rejected successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in handleRejectOvertimeRow:", error);
    res.status(500).json({
      success: false,
      error: "Failed to reject overtime",
      details: error.message,
    });
  }
};

const getOvertimeDetailsHandler = async (req, res) => {
  try {
    const data = await getAllOvertimeDetails();
    res.status(200).json({
      success: true,
      message: "All overtime details retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("❌ Error fetching overtime details:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch overtime details",
      details: error.message,
    });
  }
};

const getEmployeeLopHandler = async (req, res) => {
  try {
    const lopDetails = await getEmployeeLopDetailsForCurrentPeriod();
    res.status(200).json({
      success: true,
      message: "LOP details fetched successfully",
      data: lopDetails,
    });
  } catch (error) {
    console.error("Error in getEmployeeLopHandler:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch LOP details",
      error: error.message,
    });
  }
};

module.exports = {
  checkEmployeeAssignmentHandler,
  assignCompensationHandler,
  getAssignedCompensationDetailsHandler,
  addEmployeeBonusHandler,
  addEmployeeBonusBulkHandler,
  getEmployeeBonusDetailsHandler,
  addEmployeeAdvanceHandler,
  getEmployeeAdvanceDetailsHandler,
  fetchEmployeeExtraHours,
  handleAddOvertimeDetailsBulk,
  handleApproveOvertimeRow,
  handleRejectOvertimeRow,
  getOvertimeDetailsHandler,
  getEmployeeLopHandler,
};
