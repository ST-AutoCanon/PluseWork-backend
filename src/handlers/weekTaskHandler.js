

const weekTaskService = require("../services/weekTaskService");

const getOrgIdFromHeaders = (req) =>
  req.headers["x-org-id"] ||
  req.headers["x_org_id"] ||
  req.headers["org-id"] ||
  req.headers["orgid"];

exports.createWeekTask = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    if (!orgId) {
      return res.status(400).json({ error: "org_id is required" });
    }

    const taskId = await weekTaskService.createWeekTask(orgId, req.body);
    res.status(201).json({ message: "Week task created", taskId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create week task" });
  }
};

exports.getWeekTasksByWeek = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    const { week_id } = req.params;

    if (!orgId) {
      return res.status(400).json({ error: "org_id is required" });
    }

    const tasks = await weekTaskService.getWeekTasksByWeek(orgId, week_id);
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch week tasks" });
  }
};

exports.getWeekTasksByEmployee = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    const { employee_id } = req.params;

    if (!orgId) {
      return res.status(400).json({ error: "org_id is required" });
    }

    const tasks = await weekTaskService.getWeekTasksByEmployee(
      orgId,
      employee_id
    );
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to fetch week tasks for employee" });
  }
};

exports.updateWeekTask = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    const task_id = req.params.id;

    if (!orgId) {
      return res.status(400).json({ error: "org_id is required" });
    }

    const updated = await weekTaskService.updateWeekTask(
      orgId,
      task_id,
      req.body
    );

    if (updated) res.json({ message: "Week task updated" });
    else res.status(404).json({ error: "Week task not found" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update week task" });
  }
};

exports.deleteWeekTask = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    const task_id = req.params.id;

    if (!orgId) {
      return res.status(400).json({ error: "org_id is required" });
    }

    const deleted = await weekTaskService.deleteWeekTask(orgId, task_id);

    if (deleted) res.json({ message: "Week task deleted" });
    else res.status(404).json({ error: "Week task not found" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete week task" });
  }
};
