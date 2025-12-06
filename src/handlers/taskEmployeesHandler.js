const taskService = require("../services/taskEmployeesService");

const getTasksByEmployee1 = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const tasks = await taskService.getTasksByEmployee1(employeeId);

    if (!tasks || tasks.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { getTasksByEmployee1 };
