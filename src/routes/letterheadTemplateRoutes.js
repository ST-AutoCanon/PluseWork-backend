const express = require("express");
const router = express.Router();

const {
  addTemplateHandler,
  getAllTemplatesHandler,
} = require("../handlers/letterheadTemplateHandler");

// SAME STYLE AS ASSETS
router.post("/add", addTemplateHandler);

router.get("/list", getAllTemplatesHandler);

module.exports = router;



