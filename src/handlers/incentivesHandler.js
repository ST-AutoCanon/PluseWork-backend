


const { 
  insertIncentive, 
  getIncentivesByEmployee, 
  getAllIncentives 
} = require("../services/incentivesService");

// Insert new incentive
const handleInsertIncentive = async (req, res) => {
  try {
    const { employeeId, incentiveType, ctcPercentage, salesAmount, applicableMonth } = req.body;

    if (!employeeId || !applicableMonth) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Convert to YYYY-MM string
    const date = new Date(applicableMonth);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const monthString = `${year}-${month}`; // store in DB as YYYY-MM

    const result = await insertIncentive(
      employeeId,
      incentiveType,
      ctcPercentage,
      salesAmount,
      monthString
    );

    res.status(201).json({ message: "Incentive added successfully", insertId: result.insertId });
  } catch (error) {
    console.error("Error inserting incentive:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get incentives by employee
const handleGetIncentivesByEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const incentives = await getIncentivesByEmployee(employeeId);
    res.status(200).json({ data: incentives });
  } catch (error) {
    console.error("Error fetching incentives by employee:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get all incentives
const handleGetAllIncentives = async (req, res) => {
  try {
    const incentives = await getAllIncentives();
    res.status(200).json({
      success: true,
      message: incentives.length
        ? "Incentives retrieved successfully"
        : "No incentives found",
      data: incentives,
    });
  } catch (error) {
    console.error("Error fetching all incentives:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch incentives",
      details: error.message,
    });
  }
};


module.exports = {
  handleInsertIncentive,
  handleGetIncentivesByEmployee,
  handleGetAllIncentives,
};
