const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const LeaveHandler = require("../handlers/leaveHandler");

const router = express.Router();

const ATTACHMENTS_ROOT = path.resolve(__dirname, "../../../leave_attachments");

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

      const destDir = path.join(
        ATTACHMENTS_ROOT,
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
  limits: { fileSize: 10 * 1024 * 1024 },
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

function resolveOrgIdFromReq(req) {
  const header =
    req.headers && (req.headers["x-org-id"] || req.headers["x_org_id"]);
  const body = req.body && (req.body.orgId || req.body.org_id);
  const query = req.query && (req.query.orgId || req.query.org_id);
  const userOrg =
    req.user && (req.user.orgId || req.user.Org_id || req.user.org_id);
  return header || body || query || userOrg || null;
}

router.get("/types", LeaveHandler.getLeaveTypesHandler);

router.get("/employee/leave/:employeeId", LeaveHandler.getLeaveRequestsHandler);

router.get(
  "/team-lead/:teamLeadId",
  LeaveHandler.getLeaveRequestsForTeamLeadHandler,
);
router.get("/admin/leave", LeaveHandler.getLeaveQueries);
router.put("/admin/leave/:leaveId", LeaveHandler.updateLeaveRequest);

router.put(
  "/edit/:leaveId",
  runUpload(upload.array("attachments")),
  LeaveHandler.editLeaveRequestHandler,
);
router.delete(
  "/cancel/:leaveId/:employeeId",
  LeaveHandler.cancelLeaveRequestHandler,
);

router.get("/attachments/byname", LeaveHandler.serveAttachmentByName);

router.post(
  "/employee/leave",
  runUpload(upload.array("attachments")),
  LeaveHandler.submitLeaveRequestHandler,
);

router.post(
  "/api/employee/leave/:id/attachments",
  runUpload(upload.array("attachments")),
  LeaveHandler.addAttachmentsHandler,
);
router.get(
  "/api/employee/leave/:id/attachments",
  LeaveHandler.getAttachmentsHandler,
);

router.post(
  "/employee/leave/:id/attachments",
  runUpload(upload.array("attachments")),
  LeaveHandler.addAttachmentsHandler,
);
router.get(
  "/employee/leave/:id/attachments",
  LeaveHandler.getAttachmentsHandler,
);

router.put(
  "/employee/leave/:id/attachments",
  runUpload(upload.array("attachments")),
  LeaveHandler.replaceAttachmentsHandler,
);

router.delete(
  "/employee/leave/:id/attachments/:attachmentId",
  LeaveHandler.deleteAttachmentHandler,
);

router.get("/attachments/:attachmentId", LeaveHandler.serveAttachmentHandler);

router.post(
  "/leave/upload",
  runUpload(upload.array("attachments", 5)),
  (req, res) => {
    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) {
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

router.get("/leave_attachments/:orgId/:employeeId/:filename", (req, res) => {
  try {
    const { orgId, employeeId, filename } = req.params;

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

    const filePath = path.join(
      ATTACHMENTS_ROOT,
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

module.exports = router;
