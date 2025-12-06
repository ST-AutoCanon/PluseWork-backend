const adminSalaryStatementService = require("../services/adminSalaryStatementService");

const adminSalaryStatementHandler = {
  fetchSalaryStatement: async (req, res) => {
    try {
      const orgId =
        req.headers.orgid ||
        req.headers["x-org-id"] ||
        req.headers["orgId"] ||
        req.headers["org-id"];

      if (!orgId) {
        return res
          .status(400)
          .json({ error: "Missing required header: orgId" });
      }

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
};

module.exports = adminSalaryStatementHandler;
