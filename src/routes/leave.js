// src/routes/leave.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const LeaveHandler = require("../handlers/leaveHandler"); // <--- use this name

const router = express.Router();

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
        "unknown";
      const employeeId =
        req.headers?.["x-employee-id"] ||
        req.headers?.["x_employee_id"] ||
        req.query?.employeeId ||
        req.params?.employeeId ||
        req.body?.employeeId ||
        "unknown";

      const destDir = path.join(
        process.cwd(),
        "uploads",
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

const allowedExt = new Set([".pdf", ".png", ".jpg", ".jpeg"]);
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

const runUpload = (mw) => (req, res, next) => {
  mw(req, res, (err) => {
    if (err) {
      const msg = err && err.message ? err.message : "File upload error";
      return res.status(400).json({ success: false, code: 400, message: msg });
    }
    return next();
  });
};

/* ------------- leave endpoints ------------- */
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

/* ------------- attachments & submit ------------- */
/**
 * POST /employee/leave
 * Accepts multipart form-data (attachments optional) OR application/json.
 * Using runUpload(upload.array('attachments')) works when there's no multipart body too.
 */
router.post(
  "/employee/leave",
  runUpload(upload.array("attachments")),
  LeaveHandler.submitLeaveRequestHandler,
);

// Get attachments metadata
router.get(
  "/employee/leave/:id/attachments",
  LeaveHandler.getAttachmentsHandler,
);

// Append attachments to an existing leave
router.post(
  "/employee/leave/:id/attachments",
  runUpload(upload.array("attachments")),
  LeaveHandler.addAttachmentsHandler,
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

// Serve attachment file
router.get("/attachments/:attachmentId", LeaveHandler.serveAttachmentHandler);

module.exports = router;
