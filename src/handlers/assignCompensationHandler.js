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

const getOrgId = (req) =>
  req.user?.org_id || req.headers["x-org-id"] || req.headers["org-id"] || null;

const getWorkingDaysHandler = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "orgId is required",
      });
    }

    const totalWorkingDays = await getWorkingDaysCurrentMonth(orgId);

    res.status(200).json({
      success: true,
      message: "Working days fetched successfully",
      data: { totalWorkingDays },
    });
  } catch (error) {
    console.error("❌ Error fetching working days:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch working days",
      error: error.message,
    });
  }
};

const checkEmployeeAssignmentHandler = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { employeeId } = req.body;

    if (!orgId || !employeeId) {
      return res.status(400).json({
        success: false,
        message: "orgId and employeeId are required",
      });
    }

    const result = await checkEmployeeAssignment(orgId, employeeId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("❌ Error checking employee assignment:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const assignCompensationHandler = async (req, res) => {
  try {
    const orgId = getOrgId(req);

    const {
      compensationPlanName,
      employeeId = [],
      departmentIds = [],
      assignedBy,
    } = req.body;

    if (!orgId || !compensationPlanName || !assignedBy) {
      return res.status(400).json({
        success: false,
        message: "orgId, compensationPlanName and assignedBy are required",
      });
    }

    if (
      (!employeeId || employeeId.length === 0) &&
      (!departmentIds || departmentIds.length === 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one employeeId or departmentId",
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
      data: result,
    });
  } catch (error) {
    console.error("❌ Error assigning compensation:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getAssignedCompensationDetailsHandler = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "orgId is required",
      });
    }

    const data = await getAssignedCompensationDetails(orgId);

    res.status(200).json({
      success: true,
      message: data.length
        ? "Assigned compensation data retrieved"
        : "No assigned compensations found",
      data,
    });
  } catch (error) {
    console.error("❌ Error fetching assigned compensations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch assigned compensations",
    });
  }
};

const addEmployeeBonusHandler = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "orgId is required",
      });
    }

    const {
      percentageCtc = null,
      percentageMonthlySalary = null,
      fixedAmount = null,
      applicableMonth,
    } = req.body;

    if (!applicableMonth) {
      return res.status(400).json({
        success: false,
        message: "applicableMonth is required",
      });
    }

    const result = await addEmployeeBonus({
      orgId,
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
      error: error.message,
    });
  }
};

const addEmployeeBonusBulkHandler = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(400).json({
        success: false,
        error: "orgId required",
      });
    }

    let { bonusList } = req.body;

    if (!bonusList) {
      if (
        req.body.percentageCtc ||
        req.body.percentageMonthlySalary ||
        req.body.fixedAmount ||
        req.body.applicableMonth
      ) {
        bonusList = [req.body];
      } else {
        return res.status(400).json({
          success: false,
          error: "bonusList is required and must be an array",
        });
      }
    }

    if (!Array.isArray(bonusList)) {
      bonusList = [bonusList];
    }

    const payload = bonusList.map((b) => ({
      org_id: orgId,
      percentageCtc: b.percentageCtc ?? null,
      percentageMonthlySalary: b.percentageMonthlySalary ?? null,
      fixedAmount: b.fixedAmount ?? null,
      applicableMonth: b.applicableMonth,
    }));

    const result = await addEmployeeBonusBulk({ orgId, bonusList: payload });
    res.status(200).json({
      success: true,
      message: "Bonus added successfully",
      data: result,
    });
  } catch (error) {
    console.error("❌ Bulk bonus error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getEmployeeBonusDetailsHandler = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "orgId is required",
      });
    }

    const data = await getEmployeeBonusDetails(orgId);

    res.status(200).json({
      success: true,
      message: "Bonus details retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("❌ Error fetching bonus details:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const addEmployeeAdvanceHandler = async (req, res) => {
  try {
    const orgId = getOrgId(req);

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "orgId is required",
      });
    }

    const { employeeId, advanceAmount, recoveryMonths, applicableMonth } =
      req.body;

    if (!employeeId || !advanceAmount || !recoveryMonths || !applicableMonth) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    let formattedMonth;
    if (typeof applicableMonth === "string") {
      formattedMonth = applicableMonth;
    } else if (applicableMonth instanceof Date) {
      formattedMonth = applicableMonth.toISOString().slice(0, 7);
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid applicableMonth format",
      });
    }

    console.log("Advance payload:", {
      orgId,
      employeeId,
      advanceAmount,
      recoveryMonths,
      applicableMonth: formattedMonth,
    });

    const result = await addEmployeeAdvance({
      orgId,
      employeeId,
      advanceAmount,
      recoveryMonths,
      applicableMonth: formattedMonth,
    });

    res.status(201).json({
      success: true,
      message: "Advance added successfully",
      data: result,
    });
  } catch (error) {
    console.error("❌ Error adding advance:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getEmployeeAdvanceDetailsHandler = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "orgId is required",
      });
    }

    const data = await getEmployeeAdvanceDetails(orgId);

    res.status(200).json({
      success: true,
      message: "Advance details retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("❌ Error fetching advance details:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const fetchEmployeeExtraHours = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { startDate, endDate } = req.query;

    if (!orgId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "orgId, startDate and endDate are required",
      });
    }

    const data = await getEmployeeExtraHoursService(orgId, startDate, endDate);

    res.status(200).json({
      success: true,
      message: "Extra hours retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("❌ Error fetching extra hours:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const handleAddOvertimeDetailsBulk = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const dataArray = req.body.data;

    if (!orgId || !Array.isArray(dataArray)) {
      return res.status(400).json({
        success: false,
        message: "orgId and valid data array required",
      });
    }

    const result = await addOvertimeDetailsBulk(orgId, dataArray);

    res.status(200).json({
      success: true,
      message: "Overtime details added successfully",
      data: result,
    });
  } catch (error) {
    console.error("❌ Error adding overtime:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const handleApproveOvertimeRow = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const row = req.body;

    const result = await approveOvertimeRow(orgId, row);

    res.status(200).json({
      success: true,
      message: "Overtime approved successfully",
      data: result,
    });
  } catch (error) {
    console.error("❌ Error approving overtime:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const handleRejectOvertimeRow = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const row = req.body;

    const result = await rejectOvertimeRow(orgId, row);

    res.status(200).json({
      success: true,
      message: "Overtime rejected successfully",
      data: result,
    });
  } catch (error) {
    console.error("❌ Error rejecting overtime:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getOvertimeDetailsHandler = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const data = await getAllOvertimeDetails(orgId);

    res.status(200).json({
      success: true,
      message: "Overtime details retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("❌ Error fetching overtime:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getEmployeeLopHandler = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const data = await getEmployeeLopDetailsForCurrentPeriod(orgId);

    res.status(200).json({
      success: true,
      message: "LOP details fetched successfully",
      data,
    });
  } catch (error) {
    console.error("❌ Error fetching LOP:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getWorkingDaysHandler,
  checkEmployeeAssignmentHandler,
  assignCompensationHandler,
  getAssignedCompensationDetailsHandler,
  addEmployeeBonusHandler,
  addEmployeeBonusBulkHandler,
  getEmployeeBonusDetailsHandler,
  addEmployeeAdvanceHandler,
  getEmployeeAdvanceDetailsHandler,
  fetchEmployeeExtraHours,
  handleAddOvertimeDetailsBulk, getEmployeeExtraHoursService,
  handleApproveOvertimeRow,
  handleRejectOvertimeRow,
  getOvertimeDetailsHandler,
  getEmployeeLopHandler,
};
