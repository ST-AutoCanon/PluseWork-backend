const express = require("express");
const router = express.Router();
const reimbursementHandler = require("../handlers/dashboardReimbursementhandler");

router.get(
  "/reimbursement/stats/:employeeId",
  reimbursementHandler.getReimbursementStats
);

module.exports = router;
