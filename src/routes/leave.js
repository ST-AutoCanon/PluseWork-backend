// src/routes/leave.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const LeaveHandler = require("../handlers/leaveHandler"); // existing handler in your project

const router = express.Router();

// ------------------------
// Multer storage -> leave_attachments (project root)
// ------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const orgId =
        req.headers?.["x-org-id"] ||
        req.headers?.["x_org_id"] ||
        req.headers?.["x-tenant-id"] ||
        req.query?.orgId ||
        req.query?.org_id ||
        req.params?.orgId ||
        req.body?.orgId ||
        (req.user && (req.user.orgId || req.user.org_id)) ||
        "unknown";
      const employeeId =
        req.headers?.["x-employee-id"] ||
        req.headers?.["x_employee_id"] ||
        req.query?.employeeId ||
        req.params?.employeeId ||
        req.body?.employeeId ||
        (req.user && (req.user.employeeId || req.user.id)) ||
        "unknown";

      // Use leave_attachments at project root (outside 'uploads')
      const destDir = path.join(
        process.cwd(),
        "leave_attachments",
        String(orgId),
        String(employeeId),
      );
      fs.mkdirSync(destDir, { recursive: true });
      cb(null, destDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const original = String(file.originalname || "file");
    const safe = original.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-.]/g, "");
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    cb(null, filename);
  },
});

const allowedExt = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".webp",
]);
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (allowedExt.has(ext)) return cb(null, true);
  if (file.mimetype) {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/pdf"
    )
      return cb(null, true);
  }
  return cb(
    new Error("Unsupported file type. Allowed: PDF and images."),
    false,
  );
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
});

// wrapper to surface multer errors as JSON
const runUpload = (mw) => (req, res, next) => {
  mw(req, res, (err) => {
    if (err) {
      const msg = err && err.message ? err.message : "File upload error";
      return res.status(400).json({ success: false, code: 400, message: msg });
    }
    return next();
  });
};

// helper similar to reimbursement routes
function resolveOrgIdFromReq(req) {
  const header =
    req.headers && (req.headers["x-org-id"] || req.headers["x_org_id"]);
  const body = req.body && (req.body.orgId || req.body.org_id);
  const query = req.query && (req.query.orgId || req.query.org_id);
  const userOrg =
    req.user && (req.user.orgId || req.user.Org_id || req.user.org_id);
  return header || body || query || userOrg || null;
}

// ------------------------
// Existing leave endpoints (keep as before)
// ------------------------
// leave types
router.get("/types", LeaveHandler.getLeaveTypesHandler);

// GET employee's leaves
router.get("/employee/leave/:employeeId", LeaveHandler.getLeaveRequestsHandler);

// team-lead and admin endpoints
router.get(
  "/team-lead/:teamLeadId",
  LeaveHandler.getLeaveRequestsForTeamLeadHandler,
);
router.get("/admin/leave", LeaveHandler.getLeaveQueries);
router.put("/admin/leave/:leaveId", LeaveHandler.updateLeaveRequest);

// edit / cancel
router.put("/edit/:leaveId", LeaveHandler.editLeaveRequestHandler);
router.delete(
  "/cancel/:leaveId/:employeeId",
  LeaveHandler.cancelLeaveRequestHandler,
);

// Keep previous convenience route to serve by filename if used
router.get("/attachments/byname", LeaveHandler.serveAttachmentByName);

// submit leave (multipart attachments)
router.post(
  "/employee/leave",
  runUpload(upload.array("attachments")),
  LeaveHandler.submitLeaveRequestHandler,
);

// Attachments endpoints (API and non-API compatibility)
router.post(
  "/api/employee/leave/:id/attachments",
  runUpload(upload.array("attachments")),
  LeaveHandler.addAttachmentsHandler,
);
router.get(
  "/api/employee/leave/:id/attachments",
  LeaveHandler.getAttachmentsHandler,
);

// Also expose non-api variant so frontend calls work either way
router.post(
  "/employee/leave/:id/attachments",
  runUpload(upload.array("attachments")),
  LeaveHandler.addAttachmentsHandler,
);
router.get(
  "/employee/leave/:id/attachments",
  LeaveHandler.getAttachmentsHandler,
);

// Replace attachments for a leave (delete all + add new)
router.put(
  "/employee/leave/:id/attachments",
  runUpload(upload.array("attachments")),
  LeaveHandler.replaceAttachmentsHandler,
);

// Delete one attachment
router.delete(
  "/employee/leave/:id/attachments/:attachmentId",
  LeaveHandler.deleteAttachmentHandler,
);

// Serve attachment file via DB-resolve handler (existing handler)
router.get("/attachments/:attachmentId", LeaveHandler.serveAttachmentHandler);

// ------------------------
// Direct upload helper (like reimbursement/upload) — returns filenames
// ------------------------
router.post(
  "/leave/upload",
  runUpload(upload.array("attachments", 5)),
  (req, res) => {
    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) {
      // cleanup uploaded files if org missing
      if (req.files && req.files.length) {
        req.files.forEach((f) => {
          try {
            fs.unlinkSync(f.path);
          } catch (e) {}
        });
      }
      return res
        .status(400)
        .json({ message: "orgId is required in header/body/query for upload" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const uploadedFiles = req.files.map(
      (file) => file.filename || path.basename(file.path || ""),
    );
    res.json({ message: "Files uploaded successfully", files: uploadedFiles });
  },
  (err, req, res, next) => {
    res.status(500).json({ message: err.message });
  },
);

// ------------------------
// Serve by path: /leave_attachments/:orgId/:employeeId/:filename
// (useful when metadata stores direct relative path pieces)
// ------------------------
router.get("/leave_attachments/:orgId/:employeeId/:filename", (req, res) => {
  try {
    const { orgId, employeeId, filename } = req.params;

    // basic traversal protection
    if (
      [orgId, employeeId, filename].some(
        (param) =>
          String(param).includes("..") ||
          String(param).includes("/") ||
          String(param).includes("\\"),
      )
    ) {
      return res.status(400).json({ message: "Invalid filename or path" });
    }

    // Resolve actual file path in leave_attachments root
    const filePath = path.join(
      process.cwd(),
      "leave_attachments",
      String(orgId),
      String(employeeId),
      String(filename),
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" });
    }

    const ext = path.extname(filename || "").toLowerCase();
    const mimeType =
      {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".bmp": "image/bmp",
        ".webp": "image/webp",
        ".pdf": "application/pdf",
      }[ext] || "application/octet-stream";

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error("[leave route] serve leave_attachments error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Export router
module.exports = router;
