
const {
  getAllOrganizations,
  createOrganization,
  updateOrganization,
  getSidebarAccessByOrg,
  getSidebarMenu,
  deleteOrganization: deleteOrganizationService, // Renamed to avoid conflict
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

const fetchSidebarMenu = async (req, res) => {
  try {
    const sidebarItems = await getSidebarMenu();
    res.status(200).json(sidebarItems);
  } catch (error) {
    console.error("Error fetching sidebar menu:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const deleteOrganization = async (req, res) => {
  try {
    console.log("DELETE request received:", {
      url: req?.originalUrl,
      params: req?.params,
      method: req?.method,
      headers: req?.headers,
    });

    // Validate request and parameters
    if (!req || !req.params) {
      throw new Error("Invalid request: Missing request parameters");
    }

    const orgId = req.params.id;
    if (!orgId) {
      throw new Error("Organization ID is required");
    }

    // Validate orgId format (assuming it’s numeric)
    if (!orgId.match(/^\d+$/)) {
      throw new Error("Invalid organization ID format");
    }

    // Call the service function to perform deletion
    await deleteOrganizationService(orgId);

    // Validate response object
    if (!res || typeof res.status !== "function") {
      throw new Error("Invalid response object");
    }

    res.status(200).json({ message: `Organization ${orgId} deleted successfully` });
  } catch (error) {
    console.error("Error deleting organization:", {
      message: error.message,
      stack: error.stack,
      params: req?.params,
    });

    if (!res || typeof res.status !== "function") {
      console.error("Cannot send response: Response object is invalid");
      return;
    }

    if (error.message === "Organization not found") {
      res.status(404).json({ message: "Organization not found" });
    } else if (error.message.includes("Invalid")) {
      res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: "Internal server error" });
    }
  }
};

module.exports = {
  fetchAllOrganizations,
  addOrganization,
  editOrganization,
  fetchSidebarAccessByOrg,
  fetchSidebarMenu,
  deleteOrganization,
};