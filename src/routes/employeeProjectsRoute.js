const express = require("express");
const router = express.Router();
const {
  handleGetEmployeeProjects,
} = require("../handlers/employeeProjectsHandler");

// Route to get employee, supervisor, and project data
router.get("/employee-projects", handleGetEmployeeProjects);

module.exports = router;
