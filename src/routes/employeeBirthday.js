

const express = require("express");
const router = express.Router();

const {
  getEmployeeBirthday,
} = require("../handlers/employeeBirthday");

router.get("/birthday/:email", getEmployeeBirthday);

module.exports = router;