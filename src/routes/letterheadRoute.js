const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mime = require("mime-types");
const {
  addLetterheadHandler,
  getAllLetterheadsHandler,
  updateLetterheadHandler,
  getLetterheadByIdHandler,
} = require("../handlers/letterheadHandler");

const router = express.Router();

const LETTERHEAD_BASE_DIR = path.join(__dirname, "..", "letterheadfiles");

if (!fs.existsSync(LETTERHEAD_BASE_DIR)) {
  fs.mkdirSync(LETTERHEAD_BASE_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const headerOrg =
      req.headers && (req.headers["x-org-id"] || req.headers["x_org_id"]);
    const bodyOrg = req.body && (req.body.orgId || req.body.org_id);
    const queryOrg =
      req.query && (req.query.orgId || req.query.org_id || req.query.orgid);
    const orgId = headerOrg || bodyOrg || queryOrg || "master";

    const orgDirName = `org_${String(orgId)}`;
    const orgDir = path.join(LETTERHEAD_BASE_DIR, orgDirName);
    try {
      if (!fs.existsSync(orgDir)) fs.mkdirSync(orgDir, { recursive: true });
    } catch (e) {
      console.warn("[letterhead upload] could not create org dir:", e);
    }
    cb(null, orgDir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({ storage });
const uploadFields = upload.fields([{ name: "letterhead_file", maxCount: 1 }]);

const fieldConfigs = {
  Letter: [
    { name: "letterhead_code", label: "Letterhead Code", type: "text" },
    {
      name: "template_name",
      label: "Template Name",
      type: "text",
      required: true,
    },
    { name: "subject", label: "Subject", type: "text", required: true },
    { name: "recipient_name", label: "Recipient Name", type: "text" },
    { name: "address", label: "Recipient Address", type: "text" },
    { name: "date", label: "Date", type: "date" },
    { name: "signature", label: "Signature", type: "text" },
  ],
  "Offer Letter": [
    { name: "letterhead_code", label: "Letterhead Code", type: "text" },
    {
      name: "template_name",
      label: "Template Name",
      type: "text",
      required: true,
    },
    { name: "subject", label: "Subject", type: "text", required: true },
    {
      name: "title",
      label: "Title",
      type: "select",
      options: ["Mr", "Mrs", "Miss"],
      required: true,
    },
    {
      name: "recipient_name",
      label: "Recipient Name",
      type: "text",
      required: true,
    },
    { name: "mobile_number", label: "Mobile Number", type: "tel" },
    { name: "email", label: "Email", type: "email" },
    { name: "position", label: "Position", type: "text", required: true },
    {
      name: "annual_salary",
      label: "Annual Salary",
      type: "text",
      required: true,
    },
    {
      name: "date_of_appointment",
      label: "Date of Appointment",
      type: "date",
      required: true,
    },
    { name: "address", label: "Recipient Address", type: "text" },
    { name: "date", label: "Date", type: "date" },
    { name: "signature", label: "Signature", type: "text" },
  ],
  "Bank Details": [
    { name: "letterhead_code", label: "Letterhead Code", type: "text" },
    {
      name: "template_name",
      label: "Template Name",
      type: "text",
      required: true,
    },
    { name: "subject", label: "Subject", type: "text", required: true },
    {
      name: "title",
      label: "Title",
      type: "select",
      options: ["Mr", "Mrs"],
      required: true,
    },
    {
      name: "recipient_name",
      label: "Recipient Name",
      type: "text",
      required: true,
    },
    { name: "date", label: "Date", type: "date", required: true },
    { name: "place", label: "Place", type: "text", required: true },
    { name: "position", label: "Position", type: "text" },
    {
      name: "date_of_appointment",
      label: "Date of Joining",
      type: "date",
      required: true,
    },
    { name: "address", label: "Recipient Address", type: "text" },
    { name: "signature", label: "Signature", type: "text" },
  ],
  "Bank Details Request Letter": [
    { name: "letterhead_code", label: "Letterhead Code", type: "text" },
    {
      name: "template_name",
      label: "Template Name",
      type: "text",
      required: true,
    },
    { name: "subject", label: "Subject", type: "text", required: true },
    {
      name: "title",
      label: "Title",
      type: "select",
      options: ["Mr", "Mrs"],
      required: true,
    },
    {
      name: "recipient_name",
      label: "Recipient Name",
      type: "text",
      required: true,
    },
    { name: "date", label: "Date", type: "date", required: true },
    { name: "place", label: "Place", type: "text", required: true },
    { name: "position", label: "Position", type: "text" },
    {
      name: "date_of_appointment",
      label: "Date of Joining",
      type: "date",
      required: true,
    },
    { name: "address", label: "Recipient Address", type: "text" },
    { name: "signature", label: "Signature", type: "text" },
  ],
  "Relieving Letter": [
    { name: "letterhead_code", label: "Letterhead Code", type: "text" },
    {
      name: "template_name",
      label: "Template Name",
      type: "text",
      required: true,
    },
    { name: "subject", label: "Subject", type: "text", required: true },
    {
      name: "employee_name",
      label: "Employee Name",
      type: "text",
      required: true,
    },
    { name: "position", label: "Position", type: "text", required: true },
    {
      name: "effective_date",
      label: "Effective Date",
      type: "date",
      required: true,
    },
    { name: "address", label: "Recipient Address", type: "text" },
    { name: "date", label: "Date", type: "date" },
    { name: "signature", label: "Signature", type: "text" },
  ],
};

router.post("/letterheads/add", uploadFields, addLetterheadHandler);
router.get("/letterheads/list", getAllLetterheadsHandler);
router.put("/letterheads/update/:id", uploadFields, updateLetterheadHandler);
router.get("/letterheads/:id", getLetterheadByIdHandler);

router.get("/letterheads/download/:filename", (req, res) => {
  const headerOrg =
    req.headers && (req.headers["x-org-id"] || req.headers["x_org_id"]);
  const queryOrg =
    req.query && (req.query.orgId || req.query.org_id || req.query.orgid);
  const orgId = headerOrg || queryOrg || "master";

  const filename = req.params.filename;
  const filePath = path.join(
    LETTERHEAD_BASE_DIR,
    `org_${String(orgId)}`,
    path.basename(filename)
  );

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  } else {
    return res.status(404).json({ message: "Letterhead file not found" });
  }
});

router.get("/letterheads/view/:filename", (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ message: "Forbidden: Invalid API key" });
  }

  const headerOrg =
    req.headers && (req.headers["x-org-id"] || req.headers["x_org_id"]);
  const queryOrg =
    req.query && (req.query.orgId || req.query.org_id || req.query.orgid);
  const orgId = headerOrg || queryOrg || "master";

  const filename = req.params.filename;
  const filePath = path.join(
    LETTERHEAD_BASE_DIR,
    `org_${String(orgId)}`,
    path.basename(filename)
  );

  if (fs.existsSync(filePath)) {
    const mimeType = mime.lookup(filePath) || "application/octet-stream";
    res.setHeader("Content-Type", mimeType);
    return fs.createReadStream(filePath).pipe(res);
  } else {
    return res.status(404).json({ message: "File not found" });
  }
});

router.get("/templates/fields", (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ message: "Forbidden: Invalid API key" });
  }
  return res.json({ data: fieldConfigs });
});

module.exports = router;
