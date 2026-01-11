const payrollService = require("../services/payrollService");
const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const payrollQueries = require("../constants/payrollQueries");

/* ==============================
   FETCH EMPLOYEE DETAILS
============================== */
const fetchEmployeeDetails = async (req, res) => {
  try {
    const { employee_id } = req.params;

    const orgId =
      req.headers["x-org-id"] ||
      req.headers.orgid ||
      req.headers["org-id"] ||
      req.headers["orgId"];

    if (!orgId) {
      return res.status(400).json({
        error: "Missing required header: x-org-id",
      });
    }

    const tenantPool = await getTenantPoolByOrgId(orgId);

    const [rows] = await tenantPool.execute(
      payrollQueries.GET_EMPLOYEE_DETAILS_QUERY,
      [employee_id]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "Employee not found",
      });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error("Error fetching employee details:", error);
    res.status(500).json({
      error: "Failed to fetch employee details",
      details: error.message,
    });
  }
};

/* ==============================
   GET SALARY SLIP
============================== */
const getSalarySlipHandler = async (req, res) => {
  try {
    const { employee_id, month, year } = req.query;

    const orgId =
      req.headers["x-org-id"] ||
      req.headers.orgid ||
      req.headers["org-id"] ||
      req.headers["orgId"];

    if (!orgId) {
      return res.status(400).json({
        error: "Missing required header: x-org-id",
      });
    }

    if (!employee_id || !month || !year) {
      return res.status(400).json({
        error: "employee_id, month and year are required",
      });
    }

    const tenantPool = await getTenantPoolByOrgId(orgId);

    const salarySlip = await payrollService.getSalarySlip(
      tenantPool,
      employee_id,
      Number(month),
      Number(year)
    );

    if (!salarySlip) {
      return res.status(404).json({
        message: "No salary data found",
      });
    }

    res.status(200).json(salarySlip);
  } catch (error) {
    console.error("Error in getSalarySlipHandler:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};

/* ==============================
   GET BANK DETAILS
============================== */
const handleGetEmployeeBankDetails = async (req, res) => {
  try {
    const { employee_id } = req.params;

    const orgId =
      req.headers["x-org-id"] ||
      req.headers.orgid ||
      req.headers["org-id"] ||
      req.headers["orgId"];

    if (!orgId) {
      return res.status(400).json({
        error: "Missing required header: x-org-id",
      });
    }

    const tenantPool = await getTenantPoolByOrgId(orgId);

    const [rows] = await tenantPool.execute(
      payrollQueries.GETEMPLOYEEBANKDETAILSQUERY,
      [employee_id]
    );

    if (!rows.length) {
      return res.status(200).json({
        bank_name: "",
        account_number: "",
        ifsc_code: "",
        branch_name: "",
        employee_name: "",
        pan_number: "",
      });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error("Error fetching bank details:", error);
    res.status(500).json({
      error: "Failed to fetch bank details",
      details: error.message,
    });
  }
};

module.exports = {
  getSalarySlipHandler,
  handleGetEmployeeBankDetails,
  fetchEmployeeDetails,
};
