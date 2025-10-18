const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mime = require("mime-types");
const {
  addVendorHandler,
  getAllVendorsHandler,
  updateVendorHandler,
} = require("../handlers/vendorHandler");

const router = express.Router();

const vendorFilesDir = path.join(__dirname, "..", "..", "..", "vendorfiles");

if (!fs.existsSync(vendorFilesDir)) {
  fs.mkdirSync(vendorFilesDir, { recursive: true });
}

function sanitizeName(name = "") {
  return name
    .toString()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_\-\.]/g, "");
}
function getOrgIdFromReq(req) {
  const raw =
    req.headers["x-org-id"] ||
    req.body?.orgId ||
    (req.user && req.user.orgId) ||
    "unknown-org";
  return path.basename(String(raw));
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const orgId = getOrgIdFromReq(req);
    const orgDir = path.join(vendorFilesDir, orgId);
    try {
      fs.mkdirSync(orgDir, { recursive: true });
      req.body = req.body || {};
      req.body.orgId = orgId;
      cb(null, orgDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const safeName = sanitizeName(file.originalname);
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({ storage });

const uploadFields = upload.fields([
  { name: "gst_certificate", maxCount: 1 },
  { name: "pan_card", maxCount: 1 },
  { name: "cancelled_cheque", maxCount: 1 },
  { name: "msme_certificate", maxCount: 1 },
  { name: "incorporation_certificate", maxCount: 1 },
]);

function mapVendorFilesToBody(req, res, next) {
  try {
    req.body = req.body || {};
    const orgId = getOrgIdFromReq(req);
    req.body.orgId = orgId;

    if (!req.files) return next();

    Object.entries(req.files).forEach(([field, files]) => {
      if (!files || !files.length) return;
      const filename = files[0].filename;
      req.body[field] = `/vendors/${orgId}/${path.basename(filename)}`;
    });

    next();
  } catch (err) {
    next(err);
  }
}

router.post(
  "/vendors/add",
  uploadFields,
  mapVendorFilesToBody,
  addVendorHandler
);
router.get("/vendors/list", getAllVendorsHandler);
router.put(
  "/vendors/update/:id",
  uploadFields,
  mapVendorFilesToBody,
  updateVendorHandler
);

router.get("/vendors/download/:orgId/:filename", (req, res) => {
  const { orgId: orgRaw, filename } = req.params;
  const orgId = path.basename(orgRaw);
  const safeFilename = path.basename(filename);
  const filePath = path.join(vendorFilesDir, orgId, safeFilename);

  console.log("Serving vendor file:", filePath);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ message: "Vendor file not found" });
  }
});

router.get("/vendors/view/:orgId/:filename", (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ message: "Forbidden: Invalid API key" });
  }

  const { orgId: orgRaw, filename } = req.params;
  const orgId = path.basename(orgRaw);
  const safeFilename = path.basename(filename);
  const filePath = path.join(vendorFilesDir, orgId, safeFilename);

  if (fs.existsSync(filePath)) {
    const mimeType = mime.lookup(filePath) || "application/octet-stream";
    res.setHeader("Content-Type", mimeType);
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.status(404).json({ message: "File not found" });
  }
});

module.exports = router;
