const express = require("express");
const {
  saveSalaryDetailsHandler,
  getMonthlySalaryDataHandler,
  getApprovedIdsHandler,
} = require("../handlers/salaryDetailsHandler");

const router = express.Router();

router.post("/save", saveSalaryDetailsHandler);
router.get("/get-monthly", getMonthlySalaryDataHandler);
router.get("/approved-ids", getApprovedIdsHandler);

module.exports = router;
