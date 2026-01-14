const taskService = require("../services/taskEmployeesService");

const getOrgIdFromHeaders = (req) => {
  return (
    req.headers["x-org-id"] ||
    req.headers["x_org_id"] ||
    req.headers["org-id"] ||
    req.headers["orgid"] ||
    null
  );
};

const getTasksByEmployee1 = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    if (!orgId) {
      return res.status(400).json({
        error: "Missing required header: x-org-id",
      });
    }

    const { employeeId } = req.params;
    if (!employeeId) {
      return res.status(400).json({
        error: "employeeId parameter is required",
      });
    }

    const tasks = await taskService.getTasksByEmployee1(employeeId, orgId);

    if (!tasks || tasks.length === 0) {
      return res.status(404).json({
        message: "No tasks found for this employee",
      });
    }

    res.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks by employee:", error.message);
    res.status(500).json({
      error: "Internal Server Error",
    });
  }
};

module.exports = { getTasksByEmployee1 };
