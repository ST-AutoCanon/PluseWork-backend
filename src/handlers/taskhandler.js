const taskService = require("../services/tasksServices");

const getOrgIdFromHeaders = (req) => {
  return (
    req.headers["x-org-id"] ||
    req.headers["x_org_id"] ||
    req.headers["org-id"] ||
    req.headers["orgid"] ||
    null
  );
};

const taskHandler = {
  createTask: async (req, res) => {
    try {
      const orgId = getOrgIdFromHeaders(req);
      if (!orgId) {
        return res
          .status(400)
          .json({ error: "Missing required header: x-org-id" });
      }

      const taskId = await taskService.createTask(req.body, orgId);
      res.status(201).json({ message: "Task created successfully", taskId });
    } catch (error) {
      console.error("Error creating task:", error);
      res
        .status(500)
        .json({ error: "Internal Server Error", details: error.message });
    }
  },

  getAllTasks: async (req, res) => {
    try {
      const orgId = getOrgIdFromHeaders(req);
      if (!orgId) {
        return res
          .status(400)
          .json({ error: "Missing required header: x-org-id" });
      }

      const tasks = await taskService.getAllTasks(orgId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  getTaskById: async (req, res) => {
    try {
      const orgId = getOrgIdFromHeaders(req);
      if (!orgId) {
        return res
          .status(400)
          .json({ error: "Missing required header: x-org-id" });
      }

      const task = await taskService.getTaskById(req.params.id, orgId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error fetching task:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  deleteTask: async (req, res) => {
    try {
      const orgId = getOrgIdFromHeaders(req);
      if (!orgId) {
        return res
          .status(400)
          .json({ error: "Missing required header: x-org-id" });
      }

      const affectedRows = await taskService.deleteTask(req.params.id, orgId);
      if (affectedRows === 0) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
};

module.exports = taskHandler;
