const express = require("express");
const router = express.Router();
const {
  handleGetEmployeeProjects,
} = require("../handlers/employeeProjectsHandler");

router.get("/employee-projects", handleGetEmployeeProjects);

module.exports = router;
