const employeePoliciesService = require("../services/employeePoliciesService");
const path = require("path");
const fs = require("fs");
const uploadDir = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "PolicyUploads"
);
const getOrgIdFromHeaders = (req) => {
  return (
    req.headers.org_id ||
    req.headers["org-id"] ||
    req.headers["x-org-id"] ||
    null
  );
};

const getEmployeeIdFromHeaders = (req) => {
  return (
    req.headers.employee_id ||
    req.headers["employee-id"] ||
    req.headers["x-employee-id"] ||
    null
  );
};

/* ==========================================================
   Get Employee Assigned Policies
========================================================== */

const getEmployeePoliciesHandler = async (req, res) => {
  console.log("=== Employee policies handler started ===");

  const orgId = getOrgIdFromHeaders(req);
  const employeeId = getEmployeeIdFromHeaders(req);

  console.log("orgId:", orgId);
  console.log("employeeId:", employeeId);

  try {
    console.log("Calling service...");

    const policies = await employeePoliciesService.getEmployeePolicies(
      orgId,
      employeeId
    );

    console.log("Service returned:", policies);

    return res.status(200).json({
      success: true,
      data: policies,
    });
  } catch (error) {
    console.error("Handler Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ==========================================================
   Get Policy Files
========================================================== */

const getPolicyFilesHandler = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);

  if (!orgId) {
    return res.status(400).json({
      message: "org_id header is required",
    });
  }

  const { policyId } = req.params;

  try {
    const files = await employeePoliciesService.getPolicyFiles(
      orgId,
      policyId
    );

    return res.status(200).json({
      success: true,
      data: files,
    });
  } catch (error) {
    console.error("❌ Error fetching policy files:", error);

    if (error.message === "Organization not found") {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch policy files",
    });
  }
};

/* ==========================================================
   Get Single Policy File
========================================================== */
const viewEmployeePolicyFileHandler = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);

  if (!orgId) {
    return res.status(400).json({
      success: false,
      message: "org_id header is required",
    });
  }

  const { fileId } = req.params;

  try {
    const file = await employeePoliciesService.getPolicyFileById(orgId, fileId);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    // MUST match multer destination
    const UPLOAD_BASE_FOLDER = "F:\\STS-PULSE-26\\policies";

    const filePath = path.join(
      UPLOAD_BASE_FOLDER,
      String(orgId),
      `policy_${file.policy_id}`,   // ← required subfolder
      file.file_name
    );

    console.log("Looking for file at:", filePath);
    console.log("Exists?", fs.existsSync(filePath));

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "Physical file not found",
        debug: { expectedPath: filePath },
      });
    }

    // Detect content type (optional but useful)
    const ext = path.extname(file.file_name).toLowerCase();
    const contentTypeMap = {
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    const contentType = contentTypeMap[ext] || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${file.original_file_name || file.file_name}"`
    );

    return res.sendFile(filePath);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Unable to open file",
    });
  }
};
const getPolicyFileHandler = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);

  if (!orgId) {
    return res.status(400).json({
      message: "org_id header is required",
    });
  }

  const { fileId } = req.params;

  try {
    const file = await employeePoliciesService.getPolicyFileById(
      orgId,
      fileId
    );

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: file,
    });
  } catch (error) {
    console.error("❌ Error fetching policy file:", error);

    if (error.message === "Organization not found") {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch policy file",
    });
  }
};

/* ==========================================================
   Save Acknowledgement
========================================================== */

const saveAcknowledgementHandler = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);
  const employeeId = getEmployeeIdFromHeaders(req);

  if (!orgId) {
    return res.status(400).json({
      message: "org_id header is required",
    });
  }

  if (!employeeId) {
    return res.status(400).json({
      message: "employee_id header is required",
    });
  }

  const { policyId, policyFileId } = req.body;

  if (!policyId || !policyFileId) {
    return res.status(400).json({
      message: "policyId and policyFileId are required",
    });
  }

  try {
    const result =
      await employeePoliciesService.saveAcknowledgement(
        orgId,
        employeeId,
        policyId,
        policyFileId
      );

    if (result === "already_acknowledged") {
      return res.status(200).json({
        success: true,
        message: "Already acknowledged",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Acknowledgement saved successfully",
    });
  } catch (error) {
    console.error("❌ Error saving acknowledgement:", error);

    if (error.message === "Organization not found") {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to save acknowledgement",
    });
  }
};

/* ==========================================================
   Employee Acknowledgement History
========================================================== */

const getEmployeePolicyHistoryHandler = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);
  const employeeId = getEmployeeIdFromHeaders(req);

  if (!orgId) {
    return res.status(400).json({
      message: "org_id header is required",
    });
  }

  if (!employeeId) {
    return res.status(400).json({
      message: "employee_id header is required",
    });
  }

  try {
    const history =
      await employeePoliciesService.getEmployeePolicyHistory(
        orgId,
        employeeId
      );

    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("❌ Error fetching acknowledgement history:", error);

    if (error.message === "Organization not found") {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch acknowledgement history",
    });
  }
};

module.exports = {
  getEmployeePoliciesHandler,
  getPolicyFilesHandler,
  getPolicyFileHandler,
  saveAcknowledgementHandler,
  getEmployeePolicyHistoryHandler,viewEmployeePolicyFileHandler,
};