
const express = require("express");
const router = express.Router();
const supervisorHandler = require("../handlers/supervisorHandler");

// GET employees with updates
router.get("/employees/:supervisorId", supervisorHandler.getEmployeesWithUpdates);

// POST supervisor comment (update existing or insert)
router.post("/comment", supervisorHandler.addComment);

// POST supervisor reply to a specific employee message
// router.post("/reply", supervisorHandler.replyComment);


module.exports = router;

