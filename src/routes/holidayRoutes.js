const express = require("express");
const router = express.Router();
const holidayHandler = require("../handlers/holidayHandler");
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get("/holidays", holidayHandler.getHolidays);
router.get("/holidays/template", holidayHandler.downloadTemplate);
router.post(
  "/holidays/upload",
  upload.single("file"),
  holidayHandler.uploadHolidays
);

module.exports = router;
