

const weekTaskService = require("../services/weekTaskService");
const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");

const {
  INSERT_NOTIFICATION,
  GET_SUPERVISOR,
} = require("../constants/notificationQueries");
// weekTaskHandler.js

const getOrgIdFromHeaders = (req) =>
  req.headers["x-org-id"] || req.headers["x_org_id"] || req.headers["org-id"] || req.headers["orgid"];

exports.createWeekTask = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    const actionBy = req.headers["x-employee-id"];   // ← Most reliable source

    if (!orgId) return res.status(400).json({ error: "org_id is required" });
    if (!actionBy) return res.status(400).json({ error: "action_by (x-employee-id header) is required" });

    const taskData = { ...req.body, action_by: actionBy };

    const taskId = await weekTaskService.createWeekTask(orgId, taskData);

    res.status(201).json({
      message: "Week task created",
      taskId,
      action_by: actionBy
    });
  } catch (err) {
    console.error("Create Week Task Error:", err);
    res.status(500).json({ error: "Failed to create week task" });
  }
};

exports.updateWeekTask = async (req, res) => {
  try {
    console.log("REQ PARAMS:", req.params);
    console.log("REQ BODY:", req.body);

    const orgId = getOrgIdFromHeaders(req);
    const actionBy = req.headers["x-employee-id"];

    console.log("ORG ID:", orgId);
    console.log("ACTION BY:", actionBy);

    if (!orgId) {
      return res.status(400).json({ error: "org_id is required" });
    }

    const taskData = {
      ...req.body,
      action_by: actionBy,
    };

    console.log("FINAL TASK DATA:", taskData);

    const updated = await weekTaskService.updateWeekTask(
      orgId,
      req.params.id,
      taskData
    );

    console.log("UPDATED RESULT:", updated);

    if (updated) {
      res.json({
        success: true,
        message: "Week task updated",
      });
    } else {
      res.status(404).json({
        success: false,
        error: "Week task not found",
      });
    }
  } catch (err) {
    console.error("UPDATE ERROR:", err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
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

// In weekTaskHandler.js (updateWeekTask and createWeekTask)

// exports.updateWeekTask = async (req, res) => {
//   try {
//     const orgId = getOrgIdFromHeaders(req);
//     const task_id = req.params.id;
//     const actionBy = req.headers["x-employee-id"];   // ← Most reliable

//     if (!orgId) {
//       return res.status(400).json({ error: "org_id is required" });
//     }
//     if (!actionBy) {
//       return res.status(400).json({ error: "action_by (employee id) is required" });
//     }

//     const updated = await weekTaskService.updateWeekTask(
//       orgId,
//       task_id,
//       { ...req.body, action_by: actionBy }   // ← Force it here
//     );

//     if (updated) res.json({ message: "Week task updated", action_by: actionBy });
//     else res.status(404).json({ error: "Week task not found" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Failed to update week task" });
//   }
// };

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
