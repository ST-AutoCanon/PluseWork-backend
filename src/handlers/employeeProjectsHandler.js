const { getEmployeeProjects } = require("../services/employeeProjectsService");

const handleGetEmployeeProjects = async (req, res) => {
  try {
    const employeeProjects = await getEmployeeProjects();
    res.status(200).json({ data: employeeProjects });
  } catch (error) {
    console.error("Error fetching employee projects:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  handleGetEmployeeProjects,
};
