const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const os = require("os");
const upload = multer({
  dest: path.join(os.tmpdir(), "uploads"),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const handler = require("../handlers/templateHandler");

router.post(
  "/:orgId/templates/upload-scan",
  upload.fields([
    { name: "header", maxCount: 1 },
    { name: "body", maxCount: 1 },
    { name: "footer", maxCount: 1 },
    { name: "watermark", maxCount: 1 },
    { name: "qr", maxCount: 1 },
    { name: "seal", maxCount: 1 },
  ]),
  handler.uploadScanHandler,
);

router.post(
  "/:orgId/uploads",
  upload.single("file"),
  handler.uploadImageHandler,
);

router.post(
  "/:orgId/templates",
  express.json({ limit: "50mb" }),
  handler.saveTemplateHandler,
);

router.get("/:orgId/templates", handler.listTemplatesHandler);

router.get("/:orgId/uploads/:filename", handler.serveUploadedFileHandler);

router.get("/:orgId/templates/basic", handler.listBasicTemplatesHandler);

router.put(
  "/:orgId/templates/:templateId",
  express.json({ limit: "50mb" }),
  handler.updateTemplateHandler,
);

router.delete("/:orgId/templates/:templateId", handler.deleteTemplateHandler);

module.exports = router;
