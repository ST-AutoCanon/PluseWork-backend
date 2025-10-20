const express = require("express");
const router = express.Router();
const { uploadSalaryData, upload } = require("../handlers/salaryUploadHandler");

router.post("/upload", upload.single("file"), uploadSalaryData);

module.exports = router;
