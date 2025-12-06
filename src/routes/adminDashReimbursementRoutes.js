const express = require("express");
const router = express.Router();
const {
  handleGetApprovedReimbursementLastMonth,
} = require("../handlers/adminDashReimbursementHandler");

router.get(
  "/approved-reimbursement-last-month",
  handleGetApprovedReimbursementLastMonth
);

module.exports = router;
