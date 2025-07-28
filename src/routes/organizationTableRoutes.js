// // // routes/organizationTableRoutes.js

// // const express = require("express");
// // const router = express.Router();
// // const { fetchAllOrganizations } = require("../handlers/organizationTableHandler");

// // router.get("/organizations", fetchAllOrganizations);

// // module.exports = router;

// const express = require("express");
// const router = express.Router();
// const {
//   fetchAllOrganizations,
//   addOrganization,
//   editOrganization,
//   addSidebarMenuAccess,
//   editSidebarMenuAccess,
// } = require("../handlers/organizationTableHandler");

// router.get("/organizations", fetchAllOrganizations);

// router.post("/organizations", addOrganization);
// router.put("/organizations/:id", editOrganization);

// router.post("/sidebar-menu-access", addSidebarMenuAccess);
// router.put("/sidebar-menu-access/:id", editSidebarMenuAccess);

// module.exports = router;

const express = require("express");
const router = express.Router();
const {
  fetchAllOrganizations,
  addOrganization,
  editOrganization,
  fetchSidebarMenu,
  fetchSidebarAccessByOrg
} = require("../handlers/organizationTableHandler");

router.get("/organizations", fetchAllOrganizations);
router.post("/organizations", addOrganization);
router.put("/organizations/:id", editOrganization);
router.get("/sidebar-access", fetchSidebarAccessByOrg);
router.get("/sidebar-menu", fetchSidebarMenu);
module.exports = router;
