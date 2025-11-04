const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  addAssetHandler,
  getAssetsHandler,
  getAssetAssignmentHandler,
  updateReturnDateHandler,
  assignAsset,
  getAssetCountsHandler,
  searchEmployeesHandler,
  getAssignedAssetsByEmployee,
} = require("../handlers/assetsHandler");

const router = express.Router();

const uploadDir = path.join(__dirname, "..", "..", "..", "AssetUploads");

function sanitizeOrgId(raw) {
  if (!raw) return "unknown";
  const s = String(raw).trim();
  return s.replace(/[^a-zA-Z0-9-_]/g, "_") || "unknown";
}

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
      console.error("Failed to create upload directory:", orgDir, err);
      cb(err);
    }
  },
  filename: function (req, file, cb) {
    const safeOrig = path.basename(file.originalname || "file");
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const finalName = `${unique}_${safeOrig}`;
    cb(null, finalName);
  },
});

const upload = multer({ storage });

router.post("/assets/add", upload.single("document"), addAssetHandler);
router.get("/assets/list", getAssetsHandler);
router.post("/assets/assign", assignAsset);
router.get("/assets/assigned/:assetId", getAssetAssignmentHandler);
router.put("/assets/return-date", updateReturnDateHandler);
router.get("/assets/counts", getAssetCountsHandler);
router.get("/counts", getAssetCountsHandler);
router.get("/assets/search-employees", searchEmployeesHandler);
router.get("/assigned-assets/:employeeId", getAssignedAssetsByEmployee);

router.get("/assets/download/:filename", (req, res) => {
  const rawOrg =
    req.headers["x-org-id"] || req.headers["x-orgid"] || req.headers["x-org"];
  const orgId = sanitizeOrgId(rawOrg);

  const filename = path.basename(req.params.filename || "");
  const filePath = path.join(uploadDir, orgId, filename);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ message: "File not found" });
  }
});

module.exports = router;
