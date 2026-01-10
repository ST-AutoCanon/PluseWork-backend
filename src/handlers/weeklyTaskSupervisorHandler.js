

const {
  fetchEmployeesBySupervisor,
  fetchAllEmployees,
  fetchTasksBySupervisor,
  fetchAllTasks,
  updateTaskById,
  insertNewTask,
  fetchConfig,
  updateConfig,
  fetchHolidays,
} = require("../services/weekly_task_supervisor_service");


// Flexible orgId extraction (same as holiday upload)
const getOrgIdFromHeaders = (req) => {
  return (
    req.headers["x-org-id"] ||
    req.headers["x_org_id"] ||
    req.headers["org-id"] ||
    req.headers["orgid"] ||
    null
  );
};

// Supervisor ID: from header or route param
const getSupervisorId = (req) => {
  return req.headers["x-employee-id"] || req.params.supervisorId || req.params.employeeId;
};
const getEmployees = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    const supervisorId = req.headers["x-employee-id"];  // ← changed

    if (!orgId) return res.status(400).json({ error: "Missing x-org-id header" });
    if (!supervisorId) return res.status(400).json({ error: "Supervisor ID required" });

    const employees = await fetchEmployeesBySupervisor(supervisorId, orgId);
    res.json({ success: true, employees });
  } catch (err) {
    console.error("Error fetching employees:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getAllEmployees = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    const supervisorId = req.headers["x-employee-id"];  // ← changed

    if (!orgId) return res.status(400).json({ error: "Missing x-org-id header" });
    if (!supervisorId) return res.status(400).json({ error: "Supervisor ID required" });

    const employees = await fetchAllEmployees(supervisorId, orgId);
    res.json({ success: true, employees });
  } catch (err) {
    console.error("Error fetching all employees:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
const getTasks = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    const supervisorId = req.headers["x-employee-id"];  // exact header your frontend sends

    if (!orgId) return res.status(400).json({ error: "Missing x-org-id header" });
    if (!supervisorId) return res.status(400).json({ error: "Supervisor ID required" });

    const tasks = await fetchTasksBySupervisor(supervisorId, orgId);
    res.json({ success: true, data: tasks });
  } catch (err) {
    console.error("Error fetching tasks:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};


const getAllTasks = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    const supervisorId = getSupervisorId(req);

    if (!orgId) return res.status(400).json({ error: "Missing x-org-id header" });
    if (!supervisorId) return res.status(400).json({ error: "Supervisor ID required" });

    const tasks = await fetchAllTasks(supervisorId, orgId);
    res.json({ success: true, data: tasks });
  } catch (err) {
    console.error("Error fetching all tasks:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const updateTask = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    if (!orgId) return res.status(400).json({ error: "Missing x-org-id header" });

    const taskId = req.params.taskId;
    const updateData = req.body;

    const result = await updateTaskById(taskId, updateData, orgId);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json({ success: true, message: "Task updated successfully" });
  } catch (err) {
    console.error("Error updating task:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const createTask = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    if (!orgId) return res.status(400).json({ error: "Missing x-org-id header" });

    const taskData = req.body;
    const newTask = await insertNewTask(taskData, orgId);
    res.status(201).json({ success: true, message: "Task created successfully", newTask });
  } catch (err) {
    console.error("Error creating task:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getConfig = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    const supervisorId = getSupervisorId(req);

    if (!orgId) return res.status(400).json({ error: "Missing x-org-id header" });
    if (!supervisorId) return res.status(400).json({ error: "Supervisor ID required" });

    const rows = await fetchConfig(supervisorId, orgId);
    const configData = rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    res.json({ success: true, config: configData, raw: rows });
  } catch (err) {
    console.error("Error fetching config:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const updateConfigValue = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    const supervisorId = getSupervisorId(req);
    const { key, value } = req.body;

    if (!orgId) return res.status(400).json({ error: "Missing x-org-id header" });
    if (!supervisorId) return res.status(400).json({ error: "Supervisor ID required" });

    await updateConfig(key, value, supervisorId, orgId);
    res.json({ success: true, message: "Config updated successfully" });
  } catch (err) {
    console.error("Error updating config:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getHolidays = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    const supervisorId = getSupervisorId(req);

    if (!orgId) return res.status(400).json({ error: "Missing x-org-id header" });
    if (!supervisorId) return res.status(400).json({ error: "Supervisor ID required" });

    const holidays = await fetchHolidays(supervisorId, orgId);
    res.json({ success: true, holidays });
  } catch (err) {
    console.error("Error fetching holidays:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  getEmployees,
  getAllEmployees,
  getTasks,
  getAllTasks,
  updateTask,
  createTask,
  getConfig,
  updateConfigValue,
  getHolidays,
};