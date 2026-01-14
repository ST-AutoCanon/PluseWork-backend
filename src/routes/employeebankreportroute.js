const express = require("express");
const router = express.Router();
const {
  fetchEmployeeBankDetails,
} = require("./../handlers/employeebankreport.handler");

router.post("/employee-personal-details", fetchEmployeeBankDetails);

module.exports = router;
