

const employeeTaskService = require("../services/employeeTaskUpdateService");

const updateTask = async (req, res) => {
  try {
    const { taskId } = req.params; // from URL /update/:taskId
    const { status, percentage, progress_percentage } = req.body;

    if (!taskId || !status) {
      return res.status(400).json({ message: "Task ID and Status are required" });
    }

    // Make sure the order matches the query
    const result = await employeeTaskService.updateEmployeeTask(
      taskId,               // must be number
      status,               // string: 'Completed'
      percentage,           // number
      progress_percentage   // number or null
    );

    return res.json({ message: "Task updated successfully", result });
  } catch (err) {
    console.error("Error updating task:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { updateTask };
