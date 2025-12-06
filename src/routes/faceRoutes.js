const express = require("express");
const router = express.Router();
const { handleSaveFaceData } = require("../handlers/faceHandler");

router.post("/save-face-data", handleSaveFaceData);

module.exports = router;
