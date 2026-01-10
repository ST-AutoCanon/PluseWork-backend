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
  getWorkingDaysCurrentMonth,
} = require("../services/assign_compensations");
// const org_id = req.headers["x-org-id"];
const getWorkingDaysHandler = async (req, res) => {
  try {
    const totalWorkingDays = await getWorkingDaysCurrentMonth();
    res.status(200).json({
      success: true,
      message: `Total working days for current month: ${totalWorkingDays}`,
      data: { totalWorkingDays }
    });
  } catch (error) {
    console.error("Error fetching working days:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch working days",
      details: error.message
    });
  }
};
async function checkEmployeeAssignmentHandler(req, res) {
  try {
    const orgId = req.headers["x-org-id"];
    const { employeeId } = req.body;

    if (!orgId || !employeeId) {
      return res.status(400).json({
        success: false,
        message: "orgId and employeeId are required"
      });
    }

    const result = await checkEmployeeAssignment(orgId, employeeId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}


async function assignCompensationHandler(req, res) {
  try {
    const orgId = req.headers["x-org-id"];

    const {
  compensationPlanName,
  employeeId = [],
  departmentIds = [],
  assignedBy
} = req.body;


    if (!orgId || !compensationPlanName || !assignedBy) {
      return res.status(400).json({
        success: false,
        message: "orgId, compensationPlanName and assignedBy are required"
      });
    }

    const result = await assignCompensation({
      orgId,
      employeeId,
      departmentIds,
      compensationPlanName,
      assignedBy,
      
    });

    res.status(201).json({
      success: true,
      message: "Compensation plan assigned successfully",
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}


const getAssignedCompensationDetailsHandler = async (req, res) => {
  console.log("Handler: getAssignedCompensationDetailsHandler called");

  // ✅ ADD THIS HERE
  const orgId = req.headers["x-org-id"];

  if (!orgId) {
    console.error("❌ orgId missing in headers");
    return res.status(400).json({
      success: false,
      message: "orgId is required",
    });
  }

  try {
    const data = await getAssignedCompensationDetails(orgId);

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
      message: "Failed to fetch assigned compensation details",
    });
  }
};


const addEmployeeBonusHandler = async (req, res) => {
  try {
    const org_id = req.headers['x-org-id'];

    const {
      percentageCtc = null,
      percentageMonthlySalary = null,
      fixedAmount = null,
      applicableMonth,
    } = req.body;

    if (!org_id) {
      return res.status(400).json({
        success: false,
        error: "org_id missing",
      });
    }

    if (!applicableMonth) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: applicableMonth",
      });
    }

    const result = await addEmployeeBonus({
      org_id,
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
    console.log("Received payload:", req.body);

    const {
      percentageCtc = null,
      percentageMonthlySalary = null,
      fixedAmount = null,
      applicableMonth,
    } = req.body;

    // 🔑 GET org_id CORRECTLY
    const org_id = req.user?.org_id || req.headers["x-org-id"];

    if (!org_id) {
      return res.status(400).json({
        success: false,
        error: "org_id missing",
      });
    }

    // Require applicableMonth
    if (!applicableMonth) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: applicableMonth",
      });
    }

    // At least one bonus value required
    if (
      percentageCtc === null &&
      percentageMonthlySalary === null &&
      fixedAmount === null
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Please provide at least one bonus value (CTC %, Monthly Salary %, or Fixed Amount)",
      });
    }

    // Validation
    if (percentageCtc !== null && (percentageCtc <= 0 || percentageCtc > 100)) {
      return res.status(400).json({
        success: false,
        error: "percentageCtc must be between 1 and 100",
      });
    }

    if (
      percentageMonthlySalary !== null &&
      (percentageMonthlySalary <= 0 || percentageMonthlySalary > 100)
    ) {
      return res.status(400).json({
        success: false,
        error: "percentageMonthlySalary must be between 1 and 100",
      });
    }

    const result = await addEmployeeBonusBulk({
      org_id,
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
    const org_id = req.headers["x-org-id"];

    if (!org_id) {
      return res.status(400).json({
        success: false,
        error: "org_id missing",
      });
    }

    const data = await getEmployeeBonusDetails(org_id);

    res.status(200).json({
      success: true,
      message: "Bonus details retrieved successfully",
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch bonus details",
      details: error.message,
    });
  }
};


const addEmployeeAdvanceHandler = async (req, res) => {
  try {
    console.log("Received advance payload:", req.body);

    const {
      employeeId,
      advanceAmount,
      recoveryMonths,
      applicableMonth, // Accept from frontend
    } = req.body;

    const applicableMonths = applicableMonth; // Map it internally

    if (
      !employeeId ||
      !advanceAmount || advanceAmount <= 0 ||
      !recoveryMonths || recoveryMonths <= 0 ||
      !applicableMonths
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing or invalid required fields: employeeId, advanceAmount, recoveryMonths, or applicableMonths",
      });
    }

    const result = await addEmployeeAdvance({
      employeeId,
      advanceAmount,
      recoveryMonths,
      applicableMonths, // Use mapped value
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
      data
    });
  } catch (error) {
    console.error("Error fetching employee extra hours:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch extra hours data",
      details: error.message
    });
  }
};

const handleAddOvertimeDetailsBulk = async (req, res) => {
  try {
    const dataArray = req.body.data; // expects an array of overtime records
    const result = await addOvertimeDetailsBulk(dataArray);
    res.status(200).json({
      success: true,
      message: "Overtime details added successfully",
      data: result
    });
  } catch (error) {
    console.error("Error in handleAddOvertimeDetailsBulk:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add overtime details",
      details: error.message
    });
  }
};

const handleApproveOvertimeRow = async (req, res) => {
  try {
    const row = req.body; // expects a single overtime row object
    const result = await approveOvertimeRow(row);
    res.status(200).json({
      success: true,
      message: "Overtime approved successfully",
      data: result
    });
  } catch (error) {
    console.error("Error in handleApproveOvertimeRow:", error);
    res.status(500).json({
      success: false,
      error: "Failed to approve overtime",
      details: error.message
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
      data: result
    });
  } catch (error) {
    console.error("Error in handleRejectOvertimeRow:", error);
    res.status(500).json({
      success: false,
      error: "Failed to reject overtime",
      details: error.message
    });
  }
};

const getOvertimeDetailsHandler = async (req, res) => {
  try {
    console.log("⏳ Fetching all overtime details...");
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
      data: lopDetails
    });
  } catch (error) {
    console.error("Error in getEmployeeLopHandler:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch LOP details",
      error: error.message
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
    getWorkingDaysHandler, // add this line

};