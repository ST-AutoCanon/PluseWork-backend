const express = require("express");
const router = express.Router();
const subordinateHandler = require("../handlers/subordinateHandler");

router.get("/status", subordinateHandler.getSubordinateStatus);

module.exports = router;
