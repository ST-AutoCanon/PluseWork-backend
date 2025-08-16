const express = require("express");
const router = express.Router();
const sidebarHandler = require("../handlers/sidebarHandler");

router.get("/sidebar", sidebarHandler.getSidebarMenuByOrgAndRole);

module.exports = router;
