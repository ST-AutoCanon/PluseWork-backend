const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const handler = require("../handlers/forms.handler");
const employeeHandler = require("../handlers/employees.handler");

const router = express.Router();

// ==================== MULTER SETUP FOR FORMS (Similar to Assets) ====================
const uploadDir = path.join(__dirname, "..", "..", "..", "FormUploads");

function sanitizeOrgId(raw) {
  if (!raw) return "unknown";
  const s = String(raw).trim();
  return s.replace(/[^a-zA-Z0-9-_]/g, "_") || "unknown";
}

function getMimeType(filename) {
  const ext = path.extname(filename || "").toLowerCase();
  const mimeTypes = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx":
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".csv": "text/csv",
    ".txt": "text/plain",
    ".rtf": "application/rtf",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

const allowedFileExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".csv",
  ".txt",
  ".rtf",
]);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const rawOrg =
      req.headers["x-org-id"] || req.headers["x-orgid"] || req.headers["x-org"];
    const orgId = sanitizeOrgId(rawOrg);
    const orgDir = path.join(uploadDir, orgId);

    try {
      if (!fs.existsSync(orgDir)) {
        fs.mkdirSync(orgDir, { recursive: true });
      }
      cb(null, orgDir);
    } catch (err) {
      console.error("Failed to create FormUploads directory:", orgDir, err);
      cb(err);
    }
  },
  filename: function (req, file, cb) {
    const safeOrig = path.basename(file.originalname || "file");
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const finalName = `form-${req.params.id || "unknown"}-emp-${req.headers["x-employee-id"] || "unknown"}-${unique}_${safeOrig}`;
    cb(null, finalName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (allowedFileExtensions.has(extension)) return cb(null, true);
    cb(
      new Error(
        "Allowed files: PDF, Word, Excel, PowerPoint, CSV, TXT, RTF, JPG, PNG, GIF, and WEBP"
      )
    );
  },
});

// ==================== ROUTES ====================
// Specific routes first
router.get("/forms", handler.getForms);
router.get("/forms/assigned", handler.getAssignedForms);
router.get("/forms/team-submissions", handler.getTeamSubmissions);
router.get("/forms/feedback-requests", handler.getFeedbackRequests);

// ==================== FILE DOWNLOAD ROUTE ====================
// Must come BEFORE /forms/:id route to be matched first
router.get("/forms/download/:orgId/:filename", (req, res) => {
  try {
    const { orgId, filename } = req.params;

    // Sanitize inputs to prevent path traversal
    const sanitizedOrgId = sanitizeOrgId(orgId);
    const sanitizedFilename = path.basename(filename);

    const filePath = path.join(uploadDir, sanitizedOrgId, sanitizedFilename);

    // Verify the file exists and is within the allowed directory
    const realPath = path.resolve(filePath);
    const allowedPath = path.resolve(uploadDir);

    if (!realPath.startsWith(allowedPath)) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!fs.existsSync(realPath)) {
      return res.status(404).json({ error: "File not found" });
    }

    // Serve the file with the correct MIME type so preview works correctly
    const mimeType = getMimeType(sanitizedFilename);
    res.type(mimeType);
   res.setHeader(
  "Content-Disposition",
  `inline; filename="${sanitizedFilename}"`
);

res.setHeader("Cache-Control", "private, max-age=3600");
    res.sendFile(realPath, (err) => {
      if (err) {
        console.error("File download error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to download file" });
        }
      }
    });
  } catch (err) {
    console.error("Download route error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/forms/:id", handler.getFormById);

router.post("/forms", upload.any(), handler.createForm);
router.put("/forms/:id", upload.any(), handler.updateForm);

// File Upload Route - IMPORTANT
router.post("/forms/:id/submit", upload.any(), handler.submitForm);
router.post("/forms/:id/others-feedback", handler.submitOthersFeedback);

router.get("/forms/:id/responses", handler.getResponses);
router.get(
  "/forms/:formId/responses-with-names",
  employeeHandler.getFormResponses,
);
router.post("/forms/:id/assign", handler.assignForm);
router.get("/forms/:id/assigned", handler.getFormAssignedEmployees);

router.get("/employees", employeeHandler.getEmployees);
router.get("/employees-forms", employeeHandler.getEmployees);

module.exports = router;
