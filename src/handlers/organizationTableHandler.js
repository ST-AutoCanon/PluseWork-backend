// // // handler/organizationTableHandler.js

// // const { getAllOrganizations } = require("../services/organizationTableService");

// // const fetchAllOrganizations = async (req, res) => {
// //   try {
// //     const organizations = await getAllOrganizations();
// //     res.status(200).json(organizations);
// //   } catch (error) {
// //     console.error("Error fetching organizations:", error);
// //     res.status(500).json({ message: "Internal server error" });
// //   }
// // };

// // module.exports = {
// //   fetchAllOrganizations,
// // };

// const {
//   getAllOrganizations,
//   createOrganization,
//   updateOrganization,
//   createSidebarAccess,
//   updateSidebarAccess,
// } = require("../services/organizationTableService");

// const fetchAllOrganizations = async (req, res) => {
//   try {
//     const organizations = await getAllOrganizations();
//     res.status(200).json(organizations);
//   } catch (error) {
//     console.error("Error fetching organizations:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

// const addOrganization = async (req, res) => {
//   try {
//     const newId = await createOrganization(req.body);
//     res.status(201).json({ id: newId, message: "Organization created successfully" });
//   } catch (error) {
//     console.error("Error creating organization:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

// const editOrganization = async (req, res) => {
//   try {
//     const { id } = req.params;
//     await updateOrganization(id, req.body);
//     res.status(200).json({ message: "Organization updated successfully" });
//   } catch (error) {
//     console.error("Error updating organization:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

// const addSidebarMenuAccess = async (req, res) => {
//   try {
//     const newId = await createSidebarAccess(req.body);
//     res.status(201).json({ id: newId, message: "Sidebar menu access added" });
//   } catch (error) {
//     console.error("Error creating sidebar access:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

// const editSidebarMenuAccess = async (req, res) => {
//   try {
//     const { id } = req.params;
//     await updateSidebarAccess(id, req.body);
//     res.status(200).json({ message: "Sidebar menu access updated" });
//   } catch (error) {
//     console.error("Error updating sidebar access:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

// module.exports = {
//   fetchAllOrganizations,
//   addOrganization,
//   editOrganization,
//   addSidebarMenuAccess,
//   editSidebarMenuAccess,
// };

const {
  getAllOrganizations,
  createOrganization,
  updateOrganization,
} = require("../services/organizationTableService");

const fetchAllOrganizations = async (req, res) => {
  try {
    const organizations = await getAllOrganizations();
    res.status(200).json(organizations);
  } catch (error) {
    console.error("Error fetching organizations:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const addOrganization = async (req, res) => {
  try {
    const { orgData, sidebarAccess } = req.body;
    const result = await createOrganization(orgData, sidebarAccess);
    res.status(201).json({ message: "Organization created", ...result });
  } catch (error) {
    console.error("Error adding organization:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const editOrganization = async (req, res) => {
  try {
    const orgId = req.params.id;
    const { orgData, sidebarAccess } = req.body;
    await updateOrganization(orgId, orgData, sidebarAccess);
    res.status(200).json({ message: "Organization updated" });
  } catch (error) {
    console.error("Error updating organization:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const { getSidebarAccessByOrg } = require("../services/organizationTableService");

const fetchSidebarAccessByOrg = async (req, res) => {
  try {
    const { orgId } = req.query;
    if (!orgId) return res.status(400).json({ message: "orgId is required" });

    const access = await getSidebarAccessByOrg(orgId);
    res.status(200).json(access);
  } catch (error) {
    console.error("Error fetching sidebar access:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const { getSidebarMenu } = require("../services/organizationTableService");

const fetchSidebarMenu = async (req, res) => {
  try {
    const sidebarItems = await getSidebarMenu();
    res.status(200).json(sidebarItems);
  } catch (error) {
    console.error("Error fetching sidebar menu:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  fetchAllOrganizations,
  fetchSidebarAccessByOrg,
  addOrganization,
  fetchSidebarMenu,
  editOrganization,

};
