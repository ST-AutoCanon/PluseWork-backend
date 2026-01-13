// routes/reimbursementRoutes.js
const express = require("express");
const router = express.Router();
const reimbursementHandler = require("../handlers/reimbursementHandler");
const path = require("path");
const fs = require("fs");

const upload = reimbursementHandler.upload;

/**
 * Resolve orgId from request (header, body, query, or req.user)
 */
function resolveOrgIdFromReq(req) {
  const header =
    req.headers && (req.headers["x-org-id"] || req.headers["x_org_id"]);
  const body = req.body && (req.body.orgId || req.body.org_id);
  const query = req.query && (req.query.orgId || req.query.org_id);
  const userOrg =
    req.user && (req.user.orgId || req.user.Org_id || req.user.org_id);
  return header || body || query || userOrg || null;
}

router.get("/reimbursement/employees", reimbursementHandler.getEmployees);

router.get("/reimbursements", reimbursementHandler.getAllReimbursements);

router.get(
  "/reimbursement/:employeeId",
  reimbursementHandler.getReimbursementsByEmployee
);

router.put(
  "/reimbursement/status/:id",
  reimbursementHandler.updateReimbursementStatus
);

router.put(
  "/reimbursement/payment-status/:id",
  reimbursementHandler.updatePaymentStatus
);
// new (client-friendly)
router.put(
  "/reimbursement/:id/status",
  reimbursementHandler.updateReimbursementStatus
);
router.put(
  "/reimbursement/:id/payment",
  reimbursementHandler.updatePaymentStatus
);
router.post(
  "/reimbursement",
  upload.array("attachments", 5),
  reimbursementHandler.createReimbursement
);
// metadata lookup
router.get(
  "/reimbursement/attachment/meta",
  reimbursementHandler.getAttachmentMeta
);

// canonical serve endpoint (client will call this)
router.get(
  "/reimbursement/attachment/serve",
  reimbursementHandler.serveAttachmentCanonical
);

router.put(
  "/reimbursement/:id",
  upload.array("attachments", 5),
  reimbursementHandler.updateReimbursement
);

router.delete("/reimbursement/:id", reimbursementHandler.deleteReimbursement);

router.get(
  "/team/:teamLeadId/reimbursements",
  reimbursementHandler.getTeamReimbursements
);

router.get("/projectdrop", reimbursementHandler.getAllProjects);

router.get(
  "/reimbursement/:reimbursementId/attachments",
  reimbursementHandler.getAttachmentsByReimbursementId
);

router.get("/reimbursements/export", reimbursementHandler.exportReimbursements);

// simple upload endpoint (tenant-aware — storage in multer uses orgId)
router.post(
  "/reimbursement/upload",
  upload.array("attachments", 5),
  (req, res) => {
    // ensure orgId present (multer storage requires it)
    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) {
      // cleanup uploaded files if any
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
      (file) => file.filename || path.basename(file.path || "")
    );
    res.json({ message: "Files uploaded successfully", files: uploadedFiles });
  },
  (err, req, res, next) => {
    res.status(500).json({ message: err.message });
  }
);

/**
 * Serve attachment file by year/month/employeeId/filename.
 * This route is tenant-aware — it will resolve orgId from header/query/user.
 * It tries tenant path first: reimbursement/{orgId}/{year}/{month}/{employeeId}/{filename}
 * and falls back to legacy path (without orgId) for backward compatibility.
 */
router.get("/reimbursement/:year/:month/:employeeId/:filename", (req, res) => {
  try {
    const { year, month, employeeId, filename } = req.params;

    if (
      [year, month, employeeId, filename].some(
        (param) =>
          param.includes("..") || param.includes("/") || param.includes("\\")
      )
    ) {
      return res.status(400).json({ message: "Invalid filename" });
    }

    const orgId = resolveOrgIdFromReq(req);

    // tenant-aware path
    const tenantPath = orgId
      ? path.join(
          __dirname,
          "..",
          "..",
          "reimbursement",
          String(orgId),
          year,
          month,
          employeeId,
          filename
        )
      : null;

    // legacy path (no orgId)
    const legacyPath = path.join(
      __dirname,
      "..",
      "..",
      "reimbursement",
      year,
      month,
      employeeId,
      filename
    );

    let filePath = null;
    if (tenantPath && fs.existsSync(tenantPath)) {
      filePath = tenantPath;
    } else if (fs.existsSync(legacyPath)) {
      filePath = legacyPath;
    } else {
      return res.status(404).json({ message: "File not found" });
    }

    const mimeType =
      {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".pdf": "application/pdf",
      }[path.extname(filename).toLowerCase()] || "application/octet-stream";

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error("Attachment serve error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/download/:claimId", reimbursementHandler.generateReimbursementPDF);

module.exports = router;
