const express = require("express");
const router = express.Router();
const {
  fetchAllOrganizations,
} = require("../handlers/organizationTableHandler");

router.get("/organizations", fetchAllOrganizations);

module.exports = router;
