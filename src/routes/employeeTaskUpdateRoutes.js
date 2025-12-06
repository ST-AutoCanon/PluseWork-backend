const express = require("express");
const router = express.Router();
const employeeTaskHandler = require("../handlers/employeeTaskUpdateHandler");

router.put("/update/:taskId", employeeTaskHandler.updateTask);

module.exports = router;
