const express = require("express");
const router = express.Router();
const { 
  handleInsertIncentive, 
  handleGetIncentivesByEmployee, 
  handleGetAllIncentives 
} = require("../handlers/incentivesHandler");

// Route to insert a new incentive
router.post("/", handleInsertIncentive);

// Route to get all incentives
router.get("/", handleGetAllIncentives);

// Route to get incentives for a specific employee
router.get("/:employeeId", handleGetIncentivesByEmployee);

module.exports = router;
