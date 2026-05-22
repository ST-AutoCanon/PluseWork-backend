const express = require("express");
const router = express.Router();
const employeeQueriesHandler = require("../handlers/employeeQueries");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

router.use((req, res, next) => {
  next();
});

router.get("/empquery/attachments/:filename", (req, res) => {
  const { filename } = req.params;
  let orgId =
    req.headers["x-org-id"] ||
    req.query?.orgId ||
    req.body?.orgId ||
    (req.user && req.user.orgId) ||
    null;

  // Fallback: try to get orgId from Express session
  if (!orgId && req.session && req.session.user) {
    orgId =
      req.session.user.orgId ||
      req.session.user.org_id ||
      req.session.user.organization_id ||
      null;
  }

  console.log(
    `[attachments] download attempt filename=${filename} orgId=${orgId}`,
  );

  if (!orgId) {
    console.error(
      `[attachments] orgId missing for download: ${filename}. Sources checked:`,
      {
        header: req.headers["x-org-id"],
        query: req.query?.orgId,
        user: req.user?.orgId,
        session: req.session?.user?.orgId,
      },
    );
    return res.status(400).json({ message: "orgId is required" });
  }

  if (filename.includes("..") || filename.includes("/")) {
    console.error(`[attachments] Invalid filename attempt: ${filename}`);
    return res.status(400).json({ message: "Invalid filename" });
  }

  const filePath = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "EmpQueryUploads",
    String(orgId),
    filename,
  );

  console.log(`[attachments] resolved path: ${filePath}`);

  if (fs.existsSync(filePath)) {
    console.log(`[attachments] file exists, streaming: ${filePath}`);
    const mimeType =
      {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls": "application/vnd.ms-excel",
        ".xlsx":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }[path.extname(filename).toLowerCase()] || "application/octet-stream";

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.on("error", (err) => {
      console.error(`[attachments] stream error for ${filePath}:`, err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Error reading file" });
      }
    });
    fileStream.pipe(res);
  } else {
    console.error(
      `[attachments] File not found at: ${filePath}. Directory contents:`,
      fs.existsSync(path.dirname(filePath))
        ? fs.readdirSync(path.dirname(filePath))
        : "directory does not exist",
    );
    res.status(404).json({ message: "File not found" });
  }
});

router.post(
  "/threads",
  (req, res, next) => {
    next();
  },
  employeeQueriesHandler.startThread,
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
  employeeQueriesHandler.addMessage,
);

router.get(
  "/threads/:thread_id/messages",
  (req, res, next) => {
    next();
  },
  employeeQueriesHandler.getThreadMessages,
);

router.put(
  "/threads/:thread_id/close",
  (req, res, next) => {
    next();
  },
  employeeQueriesHandler.closeThread,
);

router.get(
  "/threads",
  (req, res, next) => {
    next();
  },
  employeeQueriesHandler.getAllThreads,
);

router.get(
  "/threads/employee/:employeeId",
  (req, res, next) => {
    next();
  },
  employeeQueriesHandler.getThreadsByEmployee,
);

router.put(
  "/threads/:thread_id/messages/read",
  (req, res, next) => {
    next();
  },
  employeeQueriesHandler.markMessagesAsRead,
);

router.put(
  "/threads/:thread_id/request-close",
  (req, res, next) => next(),
  employeeQueriesHandler.requestCloseThread,
);

router.put(
  "/threads/:thread_id/reopen",
  (req, res, next) => next(),
  employeeQueriesHandler.reopenThread,
);

module.exports = router;
