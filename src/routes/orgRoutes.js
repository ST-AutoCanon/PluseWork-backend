const express = require("express");
const router = express.Router();
const { handleGetOrgNameById } = require("../handlers/orgHandler");

router.get("/org/:id", handleGetOrgNameById);

module.exports = router;
