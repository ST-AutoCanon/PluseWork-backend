const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  addLetterHandler,
  updateLetterHandler,
  getAllLettersHandler,
  getLetterByIdHandler,
  getLatestLetterIdHandler,
} = require("../handlers/letterHandler");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/letters/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

router.post("/letters", upload.single("pdf"), addLetterHandler);
router.put("/letters/:id", upload.single("pdf"), updateLetterHandler);
router.get("/letters", getAllLettersHandler);
router.get("/letters/:id", getLetterByIdHandler);
router.get("/letters/latest/id", getLatestLetterIdHandler);

module.exports = router;
