const express = require("express");
const router = express.Router();
const overtimeController = require("./../handlers/overtimeDeailsHandler");

const { bulkUpdateOvertime, fetchEmployeeExtraHours, upsertOvertimeRecords } =
  overtimeController;

router.get("/employee-extra-hours", fetchEmployeeExtraHours);

router.post("/overtime-bulk", bulkUpdateOvertime);

router.post("/overtime-upsert", upsertOvertimeRecords);

module.exports = router;
