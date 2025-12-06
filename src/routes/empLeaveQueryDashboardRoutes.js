const express = require("express");
const router = express.Router();
const leaveQueriesHandler = require("../handlers/leaveQueriesHandler");

router.get(
  "/leave-queries/:employeeId",
  leaveQueriesHandler.getLeaveQueriesHandler
);

module.exports = router;
