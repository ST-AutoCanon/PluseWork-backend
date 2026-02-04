

const express = require("express");
const path = require("path");
const fs = require("fs");
const router = express.Router();

// exitflowuploads folder at project root
const uploadDir = path.join(__dirname, "..", "..", "exitflowuploads");

router.get("/:filename", (req, res) => {
  const filename = path.basename(req.params.filename || "");
  const filePath = path.join(uploadDir, filename);

  if (fs.existsSync(filePath)) {
    res.setHeader("Content-Disposition", "attachment");
    res.download(filePath);
  } else {
    res.status(404).json({ message: "File not found" });
  }
});

module.exports = router;
