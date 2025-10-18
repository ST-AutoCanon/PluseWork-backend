const express = require("express");
const router = express.Router();
const employeeQueriesHandler = require("../handlers/employeeQueries");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

router.use((req, res, next) => {
  next();
});

router.get("/attachments/:filename", (req, res) => {
  const { filename } = req.params;
  const orgId =
    req.headers["x-org-id"] ||
    req.query?.orgId ||
    req.body?.orgId ||
    (req.user && req.user.orgId) ||
    null;

  if (filename.includes("..") || filename.includes("/")) {
    console.error(`Invalid filename attempt: ${filename}`);
    return res.status(400).json({ message: "Invalid filename" });
  }

  const filePath = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "EmpQueryUploads",
    orgId,
    filename
  );

  if (fs.existsSync(filePath)) {
    const mimeType =
      {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".pdf": "application/pdf",
      }[path.extname(filename).toLowerCase()] || "application/octet-stream";

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename=${filename}`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } else {
    console.error(`File not found: ${filename}`);
    res.status(404).json({ message: "File not found" });
  }
});

router.post(
  "/threads",
  (req, res, next) => {
    next();
  },
  employeeQueriesHandler.startThread
);

router.post(
  "/threads/:thread_id/messages",
  (req, res, next) => {
    next();
  },
  employeeQueriesHandler.upload.single("attachment"),
  (req, res, next) => {
    if (req.file) {
    }
    next();
  },
  employeeQueriesHandler.addMessage
);

router.get(
  "/threads/:thread_id/messages",
  (req, res, next) => {
    next();
  },
  employeeQueriesHandler.getThreadMessages
);

router.put(
  "/threads/:thread_id/close",
  (req, res, next) => {
    next();
  },
  employeeQueriesHandler.closeThread
);

router.get(
  "/threads",
  (req, res, next) => {
    next();
  },
  employeeQueriesHandler.getAllThreads
);

router.get(
  "/threads/employee/:employeeId",
  (req, res, next) => {
    next();
  },
  employeeQueriesHandler.getThreadsByEmployee
);

router.put(
  "/threads/:thread_id/messages/read",
  (req, res, next) => {
    next();
  },
  employeeQueriesHandler.markMessagesAsRead
);

module.exports = router;
