const express = require("express");
const router = express.Router();
const {
  fetchAllOrganizations,
  addOrganization,
  editOrganization,
  fetchSidebarMenu,
  deleteOrganization,
  fetchSidebarAccessByOrg,
} = require("../handlers/organizationTableHandler");

router.get("/organizations", fetchAllOrganizations);
router.post("/organizations", addOrganization);
router.put("/organizations/:id", editOrganization);
router.get("/sidebar-access", fetchSidebarAccessByOrg);
router.get("/sidebar-menu", fetchSidebarMenu);
router.delete("/organizations/:id", deleteOrganization);

module.exports = router;
