const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  createPolicyHandler,
  getPoliciesHandler,
  getPolicyFilesHandler,
  downloadPolicyFileHandler,
  updatePolicyHandler,
  deletePolicyFileHandler,
  deletePolicyHandler,updatePolicyFileAcknowledgementHandler,replacePolicyFileHandler
} = require("../handlers/policiesHandler");

const router = express.Router();

// ====================== MULTER CONFIG ======================
// make sure path is required at the top

// Use environment variable, fallback to a relative folder
const UPLOAD_BASE_FOLDER = process.env.POLICY_UPLOAD_PATH
  || path.join(process.cwd(), "uploads", "policies");

function sanitizeOrgId(orgId) {
  return String(orgId || "unknown")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_");
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    try {
      console.log("========== MULTER DESTINATION ==========");

      const rawOrgId = req.headers["x-org-id"] || req.headers["org-id"] || req.headers["org_id"] || "unknown";
      const orgId = sanitizeOrgId(rawOrgId);
      const policyId = req.params.policyId;

      const folder = path.join(UPLOAD_BASE_FOLDER, orgId, `policy_${policyId}`);

      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
        console.log("✅ Folder Created:", folder);
      }

      cb(null, folder);
    } catch (err) {
      console.error("Destination Error:", err);
      cb(err);
    }
  },

  filename(req, file, cb) {
    const uniqueName = Date.now() + "_" + Math.round(Math.random() * 1e9);
    const fileName = uniqueName + "_" + file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    console.log("Saved As:", fileName);
    cb(null, fileName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// ====================== UPLOAD HANDLER (Inline) ======================
const uploadPolicyFilesHandler = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"] || req.headers["org-id"] || req.headers["org_id"] || null;
    const { policyId } = req.params;

    if (!orgId) {
      return res.status(400).json({ success: false, message: "Organization Id missing" });
    }
    if (!policyId) {
      return res.status(400).json({ success: false, message: "Policy Id missing" });
    }

    const policyService = require("../services/policiesService");
    await policyService.uploadPolicyFiles(orgId, policyId, req.files, req.body);

    return res.status(200).json({
      success: true,
      message: "Files uploaded successfully",
    });
  } catch (err) {
    console.error("Upload Policy Files Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to upload files",
    });
  }
};

// ====================== ROUTES ======================
router.post("/policies/create", createPolicyHandler);

// ====================== UPLOAD ROUTE ======================
router.post(
  "/policies/upload-files/:policyId",
  (req, res, next) => {
    console.log("========== ROUTE HIT - UPLOAD FILES ==========");
    console.log("Policy ID:", req.params.policyId);
    next();
  },
  upload.fields([
    { name: "document", maxCount: 20 },
    { name: "ppt", maxCount: 20 },
    { name: "video", maxCount: 20 },
    { name: "image", maxCount: 20 },
  ]),
  (req, res, next) => {
    console.log("========== AFTER MULTER ==========");
    console.log("Files Received:", req.files ? Object.keys(req.files) : "No files");
    if (req.files) {
      Object.entries(req.files).forEach(([key, arr]) => {
        console.log(`  ${key}:`, arr.map(f => f.originalname));
      });
    }
    console.log("Body keys:", Object.keys(req.body || {}));
    next();
  },
  uploadPolicyFilesHandler
);

// ====================== REPLACE ROUTE ======================
router.put(
  "/policies/file/replace/:policyId/:fileId",
  (req, res, next) => {
    console.log("Replace file route hit for policyId:", req.params.policyId, "fileId:", req.params.fileId);
    next();
  },
  upload.fields([
    { name: "document", maxCount: 1 },
    { name: "ppt", maxCount: 1 },
    { name: "video", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  replacePolicyFileHandler
);

router.get("/policies/list", getPoliciesHandler);
router.get("/policies/files/:policyId", getPolicyFilesHandler);
router.get("/policies/download/:fileId", downloadPolicyFileHandler);
router.put("/policies/update/:policyId", updatePolicyHandler);
router.put("/policies/file/:fileId", updatePolicyFileAcknowledgementHandler);
router.delete("/policies/file/:fileId", deletePolicyFileHandler);
router.delete("/policies/:policyId", deletePolicyHandler);

module.exports = router;