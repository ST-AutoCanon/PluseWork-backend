const policyService = require("../services/policiesService");

function getOrgId(req) {
  return (
    req.headers["x-org-id"] ||
    req.headers["org-id"] ||
    req.headers["org_id"] ||
    null
  );
}
const replacePolicyFileHandler = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { fileId } = req.params;

    if (!orgId || !fileId) {
      return res.status(400).json({ success: false, message: "Missing orgId or fileId" });
    }

    const policyService = require("../services/policiesService");
    await policyService.replacePolicyFile(orgId, fileId, req.files, req.body);

    return res.status(200).json({
      success: true,
      message: "File replaced successfully",
    });
  } catch (err) {
    console.error("Replace File Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to replace file",
    });
  }
};
/* ==================== HANDLERS ==================== */

const createPolicyHandler = async (req, res) => {
  console.log(">>>> createPolicyHandler called <<<<");

  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(400).json({ success: false, message: "Organization Id missing" });
    }

    const {
      policy_name,
      allow_view,
      allow_download,
      created_by,
      employeeIds = [],
      departmentIds = [],
      assign_to_all = 0,
    } = req.body;

    console.log("========== CREATE POLICY REQUEST ==========");
    console.log("Org ID:", orgId);
    console.log("Policy Name:", policy_name);
    console.log("Employees:", employeeIds);
    console.log("Departments:", departmentIds);
    console.log("===========================================");

    if (!policy_name) {
      return res.status(400).json({ success: false, message: "Policy name is required" });
    }

    const result = await policyService.createPolicy(orgId, {
      policy_name,
      allow_view,
      allow_download,
      created_by,
      employeeIds,
      departmentIds,
      assign_to_all,
    });

    return res.status(201).json({
      success: true,
      message: "Policy created successfully",
      data: result,
    });
  } catch (err) {
    console.error("========== CREATE POLICY ERROR ==========");
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const getPoliciesHandler = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, message: "Organization Id missing" });

    const data = await policyService.getPolicies(orgId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Get Policies Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getPolicyFilesHandler = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { policyId } = req.params;
    if (!orgId) return res.status(400).json({ success: false, message: "Organization Id missing" });

    const data = await policyService.getPolicyFiles(orgId, policyId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Get Policy Files Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const downloadPolicyFileHandler = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { fileId } = req.params;
    if (!orgId || !fileId) {
      return res.status(400).json({ success: false, message: "Missing orgId or fileId" });
    }

    const file = await policyService.downloadPolicyFile(orgId, fileId);
    return res.download(file.filePath, file.originalFileName);
  } catch (err) {
    console.error("Download Policy File Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const updatePolicyHandler = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { policyId } = req.params;
    if (!orgId || !policyId) {
      return res.status(400).json({ success: false, message: "Missing orgId or policyId" });
    }

    await policyService.updatePolicy(orgId, policyId, req.body);
    return res.status(200).json({ success: true, message: "Policy updated successfully" });
  } catch (err) {
    console.error("Update Policy Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const deletePolicyFileHandler = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { fileId } = req.params;
    if (!orgId || !fileId) {
      return res.status(400).json({ success: false, message: "Missing orgId or fileId" });
    }

    await policyService.deletePolicyFile(orgId, fileId);
    return res.status(200).json({ success: true, message: "Policy file deleted successfully" });
  } catch (err) {
    console.error("Delete Policy File Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const deletePolicyHandler = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { policyId } = req.params;
    if (!orgId || !policyId) {
      return res.status(400).json({ success: false, message: "Missing orgId or policyId" });
    }

    await policyService.deletePolicy(orgId, policyId);
    return res.status(200).json({ success: true, message: "Policy deleted successfully" });
  } catch (err) {
    console.error("Delete Policy Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
const updatePolicyFileAcknowledgementHandler = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { fileId } = req.params;

    if (!orgId || !fileId) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing orgId or fileId" 
      });
    }

    const { acknowledgement_required, acknowledgement_message } = req.body;

    const policyService = require("../services/policiesService");
    
    await policyService.updatePolicyFileAcknowledgement(orgId, fileId, {
      acknowledgement_required,
      acknowledgement_message,
    });

    return res.status(200).json({
      success: true,
      message: "File acknowledgement updated successfully",
    });
  } catch (err) {
    console.error("Update Policy File Acknowledgement Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to update file",
    });
  }
};
// Remove uploadPolicyFilesHandler from here if it exists
module.exports = {
  createPolicyHandler,
  getPoliciesHandler,
  getPolicyFilesHandler,
  downloadPolicyFileHandler,
  updatePolicyHandler,
  deletePolicyFileHandler,
  deletePolicyHandler,
  updatePolicyFileAcknowledgementHandler,replacePolicyFileHandler,
};