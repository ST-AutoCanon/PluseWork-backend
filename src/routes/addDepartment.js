const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  addDepartmentHandler,
  getDepartmentsHandler,
  getEmployeesByDepartmentHandler,
  getHierarchyHandler,
  reassignDept,
  changeSupervisor,
} = require("../handlers/addDepartment");

const router = express.Router();

const uploadDir = path.join(__dirname, "../../../departments");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function sanitizeName(input = "department") {
  return input
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-+/g, "-");
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const orgRaw =
      req.headers["x-org-id"] ||
      req.body?.orgId ||
      (req.user && req.user.orgId) ||
      "unknown-org";
    const orgId = path.basename(String(orgRaw));
    const orgDir = path.join(uploadDir, orgId);

    try {
      fs.mkdirSync(orgDir, { recursive: true });
      cb(null, orgDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    let name = req.body?.name || "department";
    name = sanitizeName(name);
    const ext = path.extname(file.originalname).toLowerCase() || "";
    cb(null, `${name}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const fileTypes = /jpeg|jpg|png|gif/;
  const extName = fileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeType = fileTypes.test(file.mimetype);

  if (extName && mimeType) {
    cb(null, true);
  } else {
    cb(new Error("Only images are allowed!"), false);
  }
};

const upload = multer({ storage, fileFilter });

router.post("/departments/add", upload.single("icon"), addDepartmentHandler);

router.get("/departments", getDepartmentsHandler);

router.get("/departments/:orgId/:filename", (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey) {
    return res.status(403).json({ message: "API key is required" });
  }

  const { orgId: orgRaw, filename } = req.params;
  const orgId = path.basename(orgRaw);
  const safeFilename = path.basename(filename);
  const filePath = path.join(uploadDir, orgId, safeFilename);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error(err);
      return res.status(404).json({ message: "Image not found" });
    }
    res.sendFile(filePath);
  });
});

module.exports = router;
