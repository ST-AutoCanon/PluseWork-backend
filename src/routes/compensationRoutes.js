const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  addCompensationHandler,
  getAllCompensationsHandler,
  getCompensationByEmployeeIdHandler,
  updateCompensationHandler,
  deleteCompensationHandler,
  getAllEmployeeNamesHandler,
  getAllDepartmentNamesHandler,
  handleGetEmployeesByDepartmentId,
} = require("../handlers/compensationHandler");

const router = express.Router();

const uploadDir = path.join(__dirname, "..", "uploads", "compensations");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

router.post("/add", upload.single("document"), addCompensationHandler);

router.get("/list", getAllCompensationsHandler);

router.get("/:id", getCompensationByEmployeeIdHandler);

router.put("/update/:id", updateCompensationHandler);

router.delete("/delete/:id", deleteCompensationHandler);

router.get("/download/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadDir, filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ message: "File not found" });
  }
});

router.get("/employees/names", getAllEmployeeNamesHandler);
router.get("/departments/names", getAllDepartmentNamesHandler);
router.get(
  "/employees/by-department/:departmentId",
  handleGetEmployeesByDepartmentId
);

module.exports = router;
