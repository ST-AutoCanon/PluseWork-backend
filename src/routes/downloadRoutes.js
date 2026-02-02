const express = require("express");
const path = require("path");
const router = express.Router();

router.get("/:filename", (req, res) => {
  const filePath = path.join(
    "D:/Pulse-11/PluseWork-backend/exitflowuploads",
    req.params.filename
  );

  res.setHeader("Content-Disposition", "attachment");
  res.download(filePath);
});

module.exports = router;
