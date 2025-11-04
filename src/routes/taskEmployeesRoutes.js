// routes/tasksRoutes.js
const express = require("express");
const router = express.Router();
const handler = require("../handlers/taskEmployeesHandler");

router.get("/employee/:employeeId", handler.getTasksByEmployee1);

module.exports = router;
