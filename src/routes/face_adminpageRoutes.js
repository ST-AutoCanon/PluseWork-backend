// const express = require("express");
// const router = express.Router();
// const { handleFacePunch } = require("../handlers/face_adminpageHandler");

// router.post("/", handleFacePunch);

// module.exports = router;
const express = require("express");
const router = express.Router();
const { handleFacePunch, getFaceData } = require("../handlers/face_adminpageHandler");

// POST for punch in/out
router.post("/", handleFacePunch);

// GET for fetching all faces (for frontend)
router.get("/face-data", getFaceData);

module.exports = router;
