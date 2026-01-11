
const express = require("express");
const router = express.Router();

const {
  getPreferencesHandler,
  savePreferencesHandler,
} = require("../handlers/salaryPreferenceHandler");

router.get("/", getPreferencesHandler);
router.post("/", savePreferencesHandler);

module.exports = router;
