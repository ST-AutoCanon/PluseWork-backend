// e.g. routes/team.js
const express = require("express");
const router = express.Router();
const { getTeamMembers } = require("../handlers/teamHandler");

router.get("/members", getTeamMembers);

module.exports = router;