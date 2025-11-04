

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

// ── Employees ─────────────────────
router.get("/supervisor/employees", getEmployees);      // uses header x-employee-id
router.get("/employees/all", getAllEmployees);          // org-scoped via header

// ── Tasks ─────────────────────────
router.get("/:supervisorId", getTasks);                 // supervisor-specific
router.get("/", getAllTasks);                           // org-wide

// ── Task mutations ─────────────────
router.put("/:taskId", updateTask);
router.post("/", createTask);

// ── Config ────────────────────────
router.get("/config/data", getConfig);
router.put("/config/update", updateConfigValue);

// ── Holidays ───────────────────────
router.get("/holidays/all", getHolidays);

module.exports = router;