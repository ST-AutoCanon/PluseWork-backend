const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const queries = require("../constants/oldEmployeeDetails");
const { getOrgId } = require("../utils/getOrgId");

exports.saveOldEmployeeDetails = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({ status: "error", message: "Forbidden" });
    }

    const pool = await getTenantPoolByOrgId(orgId);
    const data = req.body;

    const values = [
      orgId,
      data.employee_name,
      data.employee_id,
      data.gender,
      data.designation,
      data.date_of_joining,
      data.account_no,
      data.working_days || 0,
      data.leaves_taken || 0,
      data.uin_no,
      data.pan_number,
      data.esi_number,
      data.pf_number,
      data.basic || 0,
      data.hra || 0,
      data.other_allowance || 0,
      data.pf || 0,
      data.esi || 0,
      data.insurance || 0,
      data.professional_tax || 0,
      data.tds || 0,
      data.gross_earnings || 0,
      data.total_deductions || 0,
      data.net_salary || 0,
      data.month,
      data.year,
    ];

    await pool.execute(queries.INSERT_OLD_EMPLOYEE_DETAILS, values);

    res.status(201).json({ message: "Payslip data saved successfully" });
  } catch (error) {
    console.error("Error saving old employee:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

exports.editOldEmployeeDetails = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ status: "error", message: "Forbidden" });

    const pool = await getTenantPoolByOrgId(orgId);
    const data = req.body;

    const values = [
      data.employee_name,
      data.gender,
      data.designation,
      data.date_of_joining,
      data.account_no,
      data.working_days || 0,
      data.leaves_taken || 0,
      data.uin_no,
      data.pan_number,
      data.esi_number,
      data.pf_number,
      data.basic || 0,
      data.hra || 0,
      data.other_allowance || 0,
      data.pf || 0,
      data.esi || 0,
      data.insurance || 0,
      data.professional_tax || 0,
      data.tds || 0,
      data.gross_earnings || 0,
      data.total_deductions || 0,
      data.net_salary || 0,
      data.month,
      data.year,
      data.employee_id,   // WHERE employee_id
      orgId               // WHERE org_id
    ];

    await pool.execute(queries.UPDATE_OLD_EMPLOYEE_DETAILS, values);

    res.json({ message: "Payslip data updated successfully" });
  } catch (error) {
    console.error("Error updating old employee:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

exports.fetchOldEmployeeDetails = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({
        status: "error",
        code: 403,
        message: "Forbidden: Invalid or missing credentials",
      });
    }

    const pool = await getTenantPoolByOrgId(orgId);
    const [rows] = await pool.execute(queries.GET_ALL_OLD_EMPLOYEE_DETAILS, [
      orgId,
    ]);

    res.json(rows);
  } catch (error) {
    console.error("Error fetching old employees:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch payslip data",
      details: error.message,
    });
  }
};



exports.getEmployeeDetails = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({
        status: "error",
        code: 403,
        message: "Forbidden: Invalid or missing credentials",
      });
    }

    const pool = await getTenantPoolByOrgId(orgId);
    const [rows] = await pool.execute(queries.GET_EMPLOYEES, [orgId]);

    res.json(rows);
  } catch (error) {
    console.error("Error fetching employee dropdown list:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch employee list",
      details: error.message,
    });
  }
};
