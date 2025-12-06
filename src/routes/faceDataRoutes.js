const express = require("express");
const router = express.Router();

const {
  handleSaveFaceData,
  handleGetFaceData,
} = require("../handlers/faceDataHandler");

router.post("/api/face-data", handleSaveFaceData);

router.get("/api/face-data/:employee_id", handleGetFaceData);

module.exports = router;
