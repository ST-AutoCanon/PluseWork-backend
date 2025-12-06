const express = require("express");
const router = express.Router();
const {
  getEmployees,
  getAllEmployees,
  getTasks,
  getAllTasks,
  updateTask,
  createTask,
  getConfig,
  updateConfigValue,
  getHolidays,
} = require("../handlers/weeklyTaskSupervisorHandler");

router.get("/supervisor/employees", getEmployees);
router.get("/employees/all", getAllEmployees);

router.get("/:supervisorId", getTasks);
router.get("/", getAllTasks);

router.put("/:taskId", updateTask);
router.post("/", createTask);

router.get("/config/data", getConfig);
router.put("/config/update", updateConfigValue);

router.get("/holidays/all", getHolidays);

module.exports = router;
