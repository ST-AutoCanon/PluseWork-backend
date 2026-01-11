const assetService = require("../services/assetsService");

const getOrgIdFromHeaders = (req) => {
  return (
    req.headers.org_id ||
    req.headers["org-id"] ||
    req.headers["x-org-id"] ||
    null
  );
};

const addAssetHandler = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);
  if (!orgId)
    return res.status(400).json({ message: "org_id header is required" });

  let { assigned_to } = req.body;
  try {
    assigned_to =
      typeof assigned_to === "string" ? JSON.parse(assigned_to) : assigned_to;
  } catch (err) {
    console.warn(
      "Could not parse assigned_to, using as provided:",
      assigned_to
    );
  }

  try {
    const {
      asset_name,
      configuration,
      valuation_date,
      category,
      sub_category,
    } = req.body;
    let { status } = req.body;
    const document_path = req.file ? `/uploads/${req.file.filename}` : null;

    const validStatuses = ["In Use", "Not Using", "Decommissioned"];
    if (!status || !validStatuses.includes(status)) status = "In Use";

    if (!asset_name || !category || (category !== "Others" && !sub_category)) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const assetData = {
      asset_name,
      configuration,
      valuation_date,
      assigned_to,
      category,
      sub_category,
      status,
      document_path,
    };

    const result = await assetService.addAsset(orgId, assetData);
    res.status(201).json({
      message: "Asset added successfully",
      asset_id: result.asset_id,
      asset_code: result.asset_code,
      asset_name: result.asset_name,
      configuration: result.configuration,
      valuation_date: result.valuation_date,
      assigned_to: result.assigned_to,
      category: result.category,
      sub_category: result.sub_category,
      status: result.status,
      document_path: result.document_path,
    });
  } catch (error) {
    console.error("❌ Error adding asset:", error);
    if (error.message === "Organization not found") {
      return res.status(404).json({ message: "Organization not found" });
    }
    res.status(500).json({ message: "Failed to add asset" });
  }
};

const getAssetsHandler = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);
  if (!orgId)
    return res.status(400).json({ message: "org_id header is required" });

  try {
    const assets = await assetService.getAssets(orgId);
    res.status(200).json(assets);
  } catch (error) {
    console.error("Error fetching assets:", error);
    if (error.message === "Organization not found") {
      return res.status(404).json({ message: "Organization not found" });
    }
    res.status(500).json({ message: "Failed to retrieve assets" });
  }
};

const assignAsset = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);
  if (!orgId)
    return res.status(400).json({ message: "org_id header is required" });

  try {
    const {
      assetId,
      assignedTo,
      employeeId,
      startDate,
      returnDate,
      comments,
      status,
    } = req.body;
    if (!assetId || !assignedTo || !startDate || !status) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const assignedData = {
      name: assignedTo,
      employeeId,
      startDate,
      returnDate: returnDate || null,
      comments: comments || "",
      status,
    };

    const result = await assetService.updateAssignedTo(
      orgId,
      assetId,
      assignedData
    );

    if (result === "not_found")
      return res
        .status(404)
        .json({ message: `Asset not found for ID: ${assetId}` });

    const msg =
      result === "updated"
        ? "Assignment updated successfully"
        : "New assignment added successfully";

    return res.status(200).json({ success: true, message: msg });
  } catch (error) {
    console.error("❌ Error assigning asset:", error);
    if (error.message === "Organization not found") {
      return res.status(404).json({ message: "Organization not found" });
    }
    res.status(500).json({ message: "Failed to assign asset" });
  }
};

const getAssetAssignmentHandler = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);
  if (!orgId)
    return res.status(400).json({ message: "org_id header is required" });

  const { assetId } = req.params;
  try {
    const assignments = await assetService.getAssignmentData(orgId, assetId);
    if (!assignments || assignments.length === 0)
      return res
        .status(404)
        .json({ message: "No assignments found for this asset." });
    return res.status(200).json(assignments);
  } catch (error) {
    console.error("Error in getAssetAssignmentHandler:", error);
    if (error.message === "Organization not found") {
      return res.status(404).json({ message: "Organization not found" });
    }
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateReturnDateHandler = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);
  if (!orgId)
    return res.status(400).json({ message: "org_id header is required" });

  try {
    const { assetId, employeeName, returnDate } = req.body;
    if (!assetId || !employeeName || !returnDate) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    await assetService.updateReturnDate(
      orgId,
      assetId,
      employeeName,
      returnDate
    );

    res.status(200).json({
      message: "Return date updated successfully",
      updatedStatus: "Returned",
    });
  } catch (error) {
    console.error("❌ Error updating return date:", error);
    if (error.message === "Organization not found") {
      return res.status(404).json({ message: "Organization not found" });
    }
    if (error.message === "Asset not found") {
      return res.status(404).json({ message: "Asset not found" });
    }
    res.status(500).json({ message: "Failed to update return date" });
  }
};

const getAssetCountsHandler = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);
  if (!orgId)
    return res.status(400).json({ message: "org_id header is required" });

  try {
    const assetCounts = await assetService.getAssetCounts(orgId);
    res.status(200).json({ success: true, data: assetCounts });
  } catch (error) {
    console.error("Error handling asset counts request:", error);
    if (error.message === "Organization not found") {
      return res.status(404).json({ message: "Organization not found" });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const searchEmployeesHandler = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);
  if (!orgId)
    return res.status(400).json({ message: "org_id header is required" });

  const { q } = req.query;
  if (!q || q.trim() === "")
    return res.status(400).json({ message: "Search query is required" });

  try {
    const employees = await assetService.searchEmployeesByName(orgId, q.trim());
    res.status(200).json({ success: true, data: employees });
  } catch (error) {
    console.error("❌ Error searching employees:", error);
    if (error.message === "Organization not found") {
      return res.status(404).json({ message: "Organization not found" });
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to search employees" });
  }
};

const getAssignedAssetsByEmployee = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);
  if (!orgId)
    return res.status(400).json({ message: "org_id header is required" });

  const { employeeId } = req.params;
  try {
    const assignedAssets = await assetService.fetchAssignedAssetsByEmployee(
      orgId,
      employeeId
    );
    res.status(200).json({ success: true, data: assignedAssets });
  } catch (error) {
    console.error("Error fetching assigned assets:", error);
    if (error.message === "Organization not found") {
      return res.status(404).json({ message: "Organization not found" });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  searchEmployeesHandler,
  addAssetHandler,
  getAssetsHandler,
  assignAsset,
  getAssetAssignmentHandler,
  updateReturnDateHandler,
  getAssetCountsHandler,
  getAssignedAssetsByEmployee,
};