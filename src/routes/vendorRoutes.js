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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, vendorFilesDir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
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

router.post("/vendors/add", uploadFields, addVendorHandler);
router.get("/vendors/list", getAllVendorsHandler);
router.put("/vendors/update/:id", uploadFields, updateVendorHandler);

router.get("/vendors/download/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(vendorFilesDir, path.basename(filename));

  console.log("Serving vendor file:", filePath);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ message: "Vendor file not found" });
  }
});

router.get("/vendors/view/:filename", (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ message: "Forbidden: Invalid API key" });
  }

  const filename = req.params.filename;
  const filePath = path.join(vendorFilesDir, path.basename(filename));
  if (fs.existsSync(filePath)) {
    const mimeType = mime.lookup(filePath) || "application/octet-stream";
    res.setHeader("Content-Type", mimeType);
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.status(404).json({ message: "File not found" });
  }
});

module.exports = router;
