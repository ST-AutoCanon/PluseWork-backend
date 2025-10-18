const {
  addDepartmentService,
  getDepartmentsService,
} = require("../services/addDepartment");

const addDepartmentHandler = async (req, res) => {
  try {
    const { name, orgId } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Department name is required" });
    }
    if (!orgId) {
      return res.status(400).json({ message: "orgId is required" });
    }

    const icon = req.file ? `/departments/${orgId}/${req.file.filename}` : null;
    await addDepartmentService(name, icon, orgId);

    return res.status(201).json({ message: "Department added successfully" });
  } catch (error) {
    if (error.message === "Department already exists") {
      return res.status(409).json({ message: error.message });
    }
    console.error("Error adding department:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getDepartmentsHandler = async (req, res) => {
  try {
    const orgId = req.query.orgId;
    if (!orgId) {
      return res.status(400).json({ message: "orgId is required" });
    }

    const departments = await getDepartmentsService(orgId);
    return res.status(200).json({ departments });
  } catch (error) {
    console.error("Error fetching departments:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { addDepartmentHandler, getDepartmentsHandler };
