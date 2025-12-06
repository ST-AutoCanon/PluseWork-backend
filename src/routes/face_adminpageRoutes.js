const express = require("express");
const router = express.Router();
const { handleFacePunch } = require("../handlers/face_adminpageHandler");

router.post("/", handleFacePunch);

module.exports = router;
