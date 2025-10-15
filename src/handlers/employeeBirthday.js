const { fetchEmployeeBirthday } = require("../services/employeeBirthday");

const getEmployeeBirthday = async (req, res) => {
  try {
    const { email } = req.params;
    console.log("email.......", email);
    const employee = await fetchEmployeeBirthday(email);
    console.log("employee.......", employee);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }
    res.status(200).json(employee);
  } catch (error) {
    console.error("Error fetching birthday:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { getEmployeeBirthday };
