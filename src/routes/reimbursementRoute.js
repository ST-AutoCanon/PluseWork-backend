const express = require("express");
const router = express.Router();
const reimbursementHandler = require("../handlers/reimbursementHandler");
const path = require("path");
const fs = require("fs");

const upload = reimbursementHandler.upload;

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

router.post(
  "/reimbursement",
  upload.array("attachments", 5),
  reimbursementHandler.createReimbursement
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

router.post(
  "/reimbursement/upload",
  upload.array("attachments", 5),
  (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const uploadedFiles = req.files.map((file) => file.filename);
    res.json({ message: "Files uploaded successfully", files: uploadedFiles });
  },
  (err, req, res, next) => {
    res.status(500).json({ message: err.message });
  }
);

router.get("/reimbursement/:year/:month/:employeeId/:filename", (req, res) => {
  const { year, month, employeeId, filename } = req.params;

  if (
    [year, month, employeeId, filename].some(
      (param) =>
        param.includes("..") || param.includes("/") || param.includes("\\")
    )
  ) {
    return res.status(400).json({ message: "Invalid filename" });
  }

  const filePath = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "reimbursement",
    year,
    month,
    employeeId,
    filename
  );

  if (fs.existsSync(filePath)) {
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
  } else {
    res.status(404).json({ message: "File not found" });
  }
});

router.get("/download/:claimId", reimbursementHandler.generateReimbursementPDF);

module.exports = router;
