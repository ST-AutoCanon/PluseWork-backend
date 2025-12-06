const express = require("express");
const router = express.Router();
const handler = require("../handlers/taskMessagesHandler");

router.post("/", handler.sendMessage);

router.get("/:taskId", handler.getMessages);

module.exports = router;
