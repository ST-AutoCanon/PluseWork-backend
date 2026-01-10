

const employeeTaskService = require("../services/employeeTaskUpdateService");

const getOrgIdFromHeaders = (req) => {
  return (
    req.headers["x-org-id"] ||
    req.headers["x_org_id"] ||
    req.headers["org-id"] ||
    req.headers["orgid"] ||
    null
  );
};

const updateTask = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    if (!orgId) {
      return res.status(400).json({ message: "Missing required header: x-org-id" });
    }

    const { taskId } = req.params;
    const { status, percentage, progress_percentage } = req.body;

    if (!taskId) {
      return res.status(400).json({ message: "Task ID is required in URL params" });
    }
    if (!status) {
      return res.status(400).json({ message: "Status is required in request body" });
    }

    const result = await employeeTaskService.updateEmployeeTask(
      taskId,
      status,
      percentage,
      progress_percentage,
      orgId
    );

    return res.json({
      success: true,
      message: "Task updated successfully",
      affectedRows: result.affectedRows,
    });
  } catch (err) {
    console.error("Error updating employee task:", err);

    if (err.message.includes("Task not found")) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { updateTask };