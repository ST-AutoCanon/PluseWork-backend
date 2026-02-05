const express = require("express");
const router = express.Router();
const handler = require("../handlers/orgWorkHours.handler");

router.post("/work-hours", handler.saveWorkHours);
router.get("/work-hours", handler.getWorkHours);

module.exports = router;
