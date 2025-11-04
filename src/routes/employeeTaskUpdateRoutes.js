
const express = require("express");
const router = express.Router();
const employeeTaskHandler = require("../handlers/employeeTaskUpdateHandler");

// PUT → Update task
router.put("/update/:taskId", employeeTaskHandler.updateTask);

module.exports = router;
