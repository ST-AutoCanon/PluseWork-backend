const express = require("express");
const router = express.Router();
const {
  handleInsertIncentive,
  handleGetIncentivesByEmployee,
  handleGetAllIncentives,
} = require("../handlers/incentivesHandler");

router.post("/", handleInsertIncentive);

router.get("/", handleGetAllIncentives);

router.get("/:employeeId", handleGetIncentivesByEmployee);

module.exports = router;
