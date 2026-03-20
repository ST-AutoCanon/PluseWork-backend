

const weekTaskService = require("../services/weekTaskService");
const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");

const {
  INSERT_NOTIFICATION,
  GET_SUPERVISOR,
} = require("../constants/notificationQueries");
const getOrgIdFromHeaders = (req) =>
  req.headers["x-org-id"] ||
  req.headers["x_org_id"] ||
  req.headers["org-id"] ||
  req.headers["orgid"];

exports.createWeekTask = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    const employeeId =
      req.body.employee_id || req.headers["x-employee-id"];

    if (!orgId) {
      return res.status(400).json({ error: "org_id is required" });
    }

    // 1️⃣ Create task
    const taskId = await weekTaskService.createWeekTask(orgId, req.body);

    // 2️⃣ 🔔 Notify Supervisor
    try {
      const db = await getTenantPoolByOrgId(orgId);

      // Get supervisor
      const [rows] = await db.query(GET_SUPERVISOR, [employeeId]);
if (rows.length && rows[0].supervisor_id) {
  const supervisorId = rows[0].supervisor_id;
        const message = `Employee ${employeeId} created a new weekly task: "${req.body.task_name}"`;

        await db.query(INSERT_NOTIFICATION, [
          supervisorId,
          null,
          null,
          message,
          new Date(),
        ]);
      }
    } catch (notifyErr) {
      console.error("Notification error:", notifyErr);
    }

    res.status(201).json({
      message: "Week task created",
      taskId,
    });

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
