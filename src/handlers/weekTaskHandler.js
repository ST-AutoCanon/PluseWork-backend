const weekTaskService = require("../services/weekTaskService");

// Create week task
exports.createWeekTask = async (req, res) => {
  try {
    const taskId = await weekTaskService.createWeekTask(req.body);
    res.status(201).json({ message: "Week task created", taskId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create week task" });
  }
};

// Get tasks by week
exports.getWeekTasksByWeek = async (req, res) => {
  try {
    const week_id = req.params.week_id;
    const tasks = await weekTaskService.getWeekTasksByWeek(week_id);
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch week tasks" });
  }
};

// Get tasks by employee_id
exports.getWeekTasksByEmployee = async (req, res) => {
  try {
    const employee_id = req.params.employee_id;
    const tasks = await weekTaskService.getWeekTasksByEmployee(employee_id);
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch week tasks for employee" });
  }
};

// Update week task
exports.updateWeekTask = async (req, res) => {
  try {
    const task_id = req.params.id;
    const updated = await weekTaskService.updateWeekTask(task_id, req.body);
    if (updated) res.json({ message: "Week task updated" });
    else res.status(404).json({ error: "Week task not found" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update week task" });
  }
};

// Delete week task
exports.deleteWeekTask = async (req, res) => {
  try {
    const task_id = req.params.id;
    const deleted = await weekTaskService.deleteWeekTask(task_id);
    if (deleted) res.json({ message: "Week task deleted" });
    else res.status(404).json({ error: "Week task not found" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete week task" });
  }
};
