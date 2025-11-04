const express = require("express");
const router = express.Router();
const weekTaskHandler = require("../handlers/weekTaskHandler");

router.post("/", weekTaskHandler.createWeekTask);
router.get("/:week_id", weekTaskHandler.getWeekTasksByWeek);
router.get("/employee/:employee_id", weekTaskHandler.getWeekTasksByEmployee);
router.put("/:id", weekTaskHandler.updateWeekTask);
router.delete("/:id", weekTaskHandler.deleteWeekTask);

module.exports = router;
