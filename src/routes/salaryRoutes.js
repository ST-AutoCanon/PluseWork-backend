const express = require("express");
const router = express.Router();
const {  upload } = require("../handlers/salaryUploadHandler");
const { uploadSalaryData } = require('../services/salaryStatementService');
router.post("/upload", upload.single("file"), uploadSalaryData);

module.exports = router;
