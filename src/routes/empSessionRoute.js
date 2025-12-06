const express = require("express");
const router = express.Router();
const attendanceHandler = require("../handlers/empSessionHandler");

router.get("/today-punch/:employeeId", attendanceHandler.getTodayPunchRecords);

module.exports = router;
