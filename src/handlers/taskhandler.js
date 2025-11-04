

const taskService = require("../services/tasksServices");

const taskHandler = {
  createTask: async (req, res) => {
    try {
      const taskId = await taskService.createTask(req.body);
      res.status(201).json({ message: "Task created successfully", taskId });
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  getAllTasks: async (req, res) => {
    try {
      const tasks = await taskService.getAllTasks();
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  getTaskById: async (req, res) => {
    try {
      const task = await taskService.getTaskById(req.params.id);
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
      const affectedRows = await taskService.deleteTask(req.params.id);
      if (!affectedRows) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
};

module.exports = taskHandler;