const express = require("express");
const { getConfig, updateConfig } = require("../handlers/configHandler");

const router = express.Router();

router.get("/config", getConfig);
router.put("/config", updateConfig);

module.exports = router;
