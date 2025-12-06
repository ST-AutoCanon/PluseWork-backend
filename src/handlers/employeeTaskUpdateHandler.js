const employeeTaskService = require("../services/employeeTaskUpdateService");

const updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status, percentage, progress_percentage } = req.body;

    if (!taskId || !status) {
      return res
        .status(400)
        .json({ message: "Task ID and Status are required" });
    }

    const result = await employeeTaskService.updateEmployeeTask(
      taskId,
      status,
      percentage,
      progress_percentage
    );

    return res.json({ message: "Task updated successfully", result });
  } catch (err) {
    console.error("Error updating task:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { updateTask };
