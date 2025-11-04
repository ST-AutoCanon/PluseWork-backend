

const db = require("../config");
const taskQueries = require("../constants/taskConstants");

const taskService = {
  createTask: async (taskData) => {
    const { employee_id, task_title, description, start_date, due_date, status, percentage } = taskData;
    const [result] = await db.query(taskQueries.insertTask, [
      employee_id, task_title, description, start_date, due_date, status, percentage
    ]);
    return result.insertId;
  },

  getAllTasks: async () => {
    const [rows] = await db.query(taskQueries.getAllTasks);
    return rows;
  },

  getTaskById: async (taskId) => {
    const [rows] = await db.query(taskQueries.getTaskById, [taskId]);
    return rows[0];
  },


  deleteTask: async (taskId) => {
    const [result] = await db.query(taskQueries.deleteTask, [taskId]);
    return result.affectedRows;
  }
};

module.exports = taskService;