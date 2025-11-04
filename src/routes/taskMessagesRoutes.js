const express = require("express");
const router = express.Router();
const handler = require("../handlers/taskMessagesHandler");

// POST → Send new message
router.post("/", handler.sendMessage);

// // GET → Fetch all messages (split into tabs)
// router.get("/:taskId/:employeeId", handler.getMessages);
router.get("/:taskId", handler.getMessages);


module.exports = router;
