// routes/subordinateRoutes.js
const express = require("express");
const router = express.Router();
const subordinateHandler = require("../handlers/subordinateHandler");

// GET /api/subordinate/status
router.get("/status", subordinateHandler.getSubordinateStatus);

module.exports = router;
