const express = require("express");
const path = require("path");
const fs = require("fs");

const {
    getEmployeePoliciesHandler,
  getPolicyFilesHandler,
  getPolicyFileHandler,
  viewEmployeePolicyFileHandler,
  saveAcknowledgementHandler,
  getEmployeePolicyHistoryHandler,
} = require("../handlers/employeePoliciesHandler");

const router = express.Router();

const uploadDir = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "PolicyUploads"
);

function sanitizeOrgId(raw) {
  if (!raw) return "unknown";
  const s = String(raw).trim();
  return s.replace(/[^a-zA-Z0-9-_]/g, "_") || "unknown";
}

/* ==========================================================
   Employee Policies
========================================================== */

// Matches frontend: GET /api/policies/employee
router.get(
  "/employee",
  getEmployeePoliciesHandler
);

// Matches: GET /api/policies/employee/:policyId/files
router.get(
  "/employee/:policyId/files",
  getPolicyFilesHandler
);

router.get(
  "/employee-policy-file/:fileId",
  getPolicyFileHandler
);
router.get(
  "/employee-policy/view/:fileId",
  viewEmployeePolicyFileHandler
);

router.post(
  "/employee-policy/acknowledgement",
  saveAcknowledgementHandler
);

router.get(
  "/employee-policy/history",
  getEmployeePolicyHistoryHandler
);

/* ==========================================================
   View / Download Policy File
========================================================== */

router.get("/employee-policy/download/:filename", (req, res) => {
  const rawOrg =
    req.headers["x-org-id"] ||
    req.headers["x-orgid"] ||
    req.headers["x-org"];

  const orgId = sanitizeOrgId(rawOrg);

  const filename = path.basename(req.params.filename || "");

  const filePath = path.join(
    uploadDir,
    orgId,
    filename
  );

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  return res.status(404).json({
    success: false,
    message: "File not found",
  });
});

module.exports = router;