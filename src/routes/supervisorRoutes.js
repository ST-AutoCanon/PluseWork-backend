const express = require("express");
const router = express.Router();
const supervisorHandler = require("../handlers/supervisorHandler");

router.get(
  "/employees/:supervisorId",
  supervisorHandler.getEmployeesWithUpdates
);

router.post("/comment", supervisorHandler.addComment);

module.exports = router;
