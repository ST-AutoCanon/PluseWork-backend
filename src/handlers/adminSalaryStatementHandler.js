const adminSalaryStatementService = require("../services/adminSalaryStatementService");

const adminSalaryStatementHandler = {
  fetchSalaryStatement: async (req, res) => {
    try {
      const orgId =
        req.headers.orgid ||
        req.headers["x-org-id"] ||
        req.headers["orgId"] ||
        req.headers["org-id"];

      if (!orgId)
        return res.status(400).json({ error: "Missing required header: orgId" });

      const { month, year } = req.params;

      const salaryData = await adminSalaryStatementService.getSalaryStatement(
        orgId,
        month,
        year
      );

      res.json({ salary_statement: salaryData });
    } catch (error) {
      console.error("Error in fetchSalaryStatement handler:", error);
      res.status(500).json({
        error: "Failed to fetch salary statement",
        details: error.message,
      });
    }
  },

  fetchEmployeeBankDetails: async (req, res) => {
    try {
      const { employeeId } = req.params;
      const bankDetails =
        await adminSalaryStatementService.getEmployeeBankDetails(employeeId);
      res.json({ bank_details: bankDetails });
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch employee bank details",
        details: error.message,
      });
    }
  },

  updatePayslipStatus: async (req, res) => {
    try {
      const orgId =
        req.headers.orgid ||
        req.headers["x-org-id"] ||
        req.headers["orgId"] ||
        req.headers["org-id"];

      if (!orgId)
        return res.status(400).json({ error: "Missing required header: orgId" });

      const { month, year, employeeId } = req.params;
      const { payslip_generated } = req.body;

      if (typeof payslip_generated === "undefined") {
        return res.status(400).json({ error: "Missing payslip_generated in request body" });
      }

      const newValue = payslip_generated === 1 || payslip_generated === true ? 1 : 0;

      const result = await adminSalaryStatementService.updatePayslipGenerated(
        orgId,
        month,
        year,
        employeeId,
        newValue
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          error: "Employee not found or no changes made in the salary statement",
        });
      }

      res.json({
        success: true,
        message: `Payslip ${newValue === 1 ? "enabled" : "disabled"} successfully`,
      });
    } catch (error) {
      console.error("Error in updatePayslipStatus handler:", error);
      res.status(500).json({
        error: "Failed to update payslip status",
        details: error.message,
      });
    }
  },
};

module.exports = adminSalaryStatementHandler;
