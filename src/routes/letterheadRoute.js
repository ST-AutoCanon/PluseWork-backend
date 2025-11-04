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

// 📁 Define upload directory for letterheads
const letterheadDir = path.join(__dirname, "..", "letterheadfiles");

// 📁 Ensure the directory exists
if (!fs.existsSync(letterheadDir)) {
  fs.mkdirSync(letterheadDir, { recursive: true });
}

// 📥 Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, letterheadDir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({ storage });

// 📑 Fields allowed for upload
const uploadFields = upload.fields([{ name: "letterhead_file", maxCount: 1 }]);

// 📑 Field configurations for letter types
const fieldConfigs = {
  Letter: [
    {
      name: "letterhead_code",
      label: "Letterhead Code",
      type: "text",
      required: false,
    },
    {
      name: "template_name",
      label: "Template Name",
      type: "text",
      required: true,
    },
    { name: "subject", label: "Subject", type: "text", required: true },
    {
      name: "recipient_name",
      label: "Recipient Name",
      type: "text",
      required: false,
    },
    {
      name: "address",
      label: "Recipient Address",
      type: "text",
      required: false,
    },
    { name: "date", label: "Date", type: "date", required: false },
    { name: "signature", label: "Signature", type: "text", required: false },
  ],
  "Offer Letter": [
    {
      name: "letterhead_code",
      label: "Letterhead Code",
      type: "text",
      required: false,
    },
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
    {
      name: "mobile_number",
      label: "Mobile Number",
      type: "tel",
      required: false,
    },
    { name: "email", label: "Email", type: "email", required: false },
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
    {
      name: "address",
      label: "Recipient Address",
      type: "text",
      required: false,
    },
    { name: "date", label: "Date", type: "date", required: false },
    { name: "signature", label: "Signature", type: "text", required: false },
  ],
  "Bank Details": [
    {
      name: "letterhead_code",
      label: "Letterhead Code",
      type: "text",
      required: false,
    },
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
    { name: "position", label: "Position", type: "text", required: false },
    {
      name: "date_of_appointment",
      label: "Date of Joining",
      type: "date",
      required: true,
    },
    {
      name: "address",
      label: "Recipient Address",
      type: "text",
      required: false,
    },
    { name: "signature", label: "Signature", type: "text", required: false },
  ],
  "Bank Details Request Letter": [
    {
      name: "letterhead_code",
      label: "Letterhead Code",
      type: "text",
      required: false,
    },
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
    { name: "position", label: "Position", type: "text", required: false },
    {
      name: "date_of_appointment",
      label: "Date of Joining",
      type: "date",
      required: true,
    },
    {
      name: "address",
      label: "Recipient Address",
      type: "text",
      required: false,
    },
    { name: "signature", label: "Signature", type: "text", required: false },
  ],
  "Relieving Letter": [
    {
      name: "letterhead_code",
      label: "Letterhead Code",
      type: "text",
      required: false,
    },
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
    {
      name: "address",
      label: "Recipient Address",
      type: "text",
      required: false,
    },
    { name: "date", label: "Date", type: "date", required: false },
    { name: "signature", label: "Signature", type: "text", required: false },
  ],
};

// ✅ Routes
router.post("/letterheads/add", uploadFields, addLetterheadHandler);
router.get("/letterheads/list", getAllLetterheadsHandler);
router.put("/letterheads/update/:id", uploadFields, updateLetterheadHandler);
router.get("/letterheads/:id", getLetterheadByIdHandler);

// 📤 Download letterhead file
router.get("/letterheads/download/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(letterheadDir, path.basename(filename));

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ message: "Letterhead file not found" });
  }
});

// 👁️ View letterhead file inline
router.get("/letterheads/view/:filename", (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ message: "Forbidden: Invalid API key" });
  }

  const filename = req.params.filename;
  const filePath = path.join(letterheadDir, path.basename(filename));

  if (fs.existsSync(filePath)) {
    const mimeType = mime.lookup(filePath) || "application/octet-stream";
    res.setHeader("Content-Type", mimeType);
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.status(404).json({ message: "File not found" });
  }
});

// 📋 Get field configurations for letter types
router.get("/templates/fields", (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ message: "Forbidden: Invalid API key" });
  }

  res.json({ data: fieldConfigs });
});

module.exports = router;
