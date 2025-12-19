
// const express = require("express");
// const { saveSalaryDetailsHandler, getApprovedIdsHandler } = require("../handlers/salaryDetailsHandler");

// const router = express.Router();

// router.post("/save", saveSalaryDetailsHandler);
// router.get("/approved-ids", getApprovedIdsHandler);

// module.exports = router;
const express = require("express");
const { 
  saveSalaryDetailsHandler, 
  getApprovedIdsHandler, 
  getMonthlySalaryDataHandler  // Add this import
} = require("../handlers/salaryDetailsHandler");

const router = express.Router();

router.post("/save", saveSalaryDetailsHandler);
router.get("/approved-ids", getApprovedIdsHandler);

// ADD THIS ROUTE
router.get("/get-monthly", getMonthlySalaryDataHandler);

module.exports = router;