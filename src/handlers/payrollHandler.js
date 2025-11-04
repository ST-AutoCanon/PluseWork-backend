const payrollService = require("../services/payrollService");
const {
  getEmployeeBankDetails,
  getEmployeeDetails,
} = require("../services/payrollService");

// payrollHandler.js
const fetchEmployeeDetails = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const employeeData = await getEmployeeDetails(employee_id);

    if (!employeeData) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.status(200).json(employeeData);
  } catch (error) {
    console.error("Error fetching employee details:", error);
    res.status(500).json({
      error: "Failed to fetch employee details",
      details: error.message,
    });
  }
};

// Make sure you export it here

const getSalarySlipHandler = async (req, res) => {
  try {
    const { month, year } = req.query;
    const employeeId = req.user?.employee_id || req.query.employee_id;

    if (!month || !year) {
      return res.status(400).json({ error: "Month and year are required." });
    }

    const salarySlip = await payrollService.getSalarySlip(
      employeeId,
      month,
      year
    );

    if (!salarySlip) {
      return res.status(404).json({ message: "No salary data found" });
    }

    res.json(salarySlip);
  } catch (error) {
    console.error("Error in getSalarySlipHandler:", error);
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
};

const handleGetEmployeeBankDetails = async (req, res) => {
  try {
    const { employee_id } = req.params; // Get employee ID from request

    const bankDetails = await getEmployeeBankDetails(employee_id);
    if (!bankDetails) {
      return res
        .status(404)
        .json({ message: "No bank details found for this employee" });
    }

    return res.status(200).json(bankDetails);
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Internal server error", details: error });
  }
};

module.exports = {
  getSalarySlipHandler,
  handleGetEmployeeBankDetails,
  fetchEmployeeDetails,
};
