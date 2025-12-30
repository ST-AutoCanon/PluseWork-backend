// handlers/employeeQueries.js
const EmployeeQueries = require("../services/employeeQueries");
const ErrorHandler = require("../utils/errorHandler");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

/**
 * Resolve orgId helper (checks headers, query, body, user)
 */
const resolveOrgIdFromReq = (req) => {
  return (
    req.headers["x-org-id"] ||
    req.headers["x_org_id"] ||
    req.query?.orgId ||
    req.body?.orgId ||
    (req.user && req.user.orgId) ||
    null
  );
};

/**
 * File storage uses org-specific subfolder under EmpQueryUploads
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const orgId = resolveOrgIdFromReq(req) || "unknown";
    const uploadPath = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "EmpQueryUploads",
      String(orgId)
    );
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });
exports.upload = upload;

exports.startThread = async (req, res) => {
  const orgId = resolveOrgIdFromReq(req);
  const { sender_id, sender_role, department_id, subject, message, role } =
    req.body;
  try {
    if (!orgId) {
      return res
        .status(400)
        .send(
          ErrorHandler.generateErrorResponse(400, "orgId header is required")
        );
    }

    const threadId = await EmployeeQueries.startThread(
      sender_id,
      sender_role,
      department_id,
      subject,
      message,
      role,
      orgId
    );
    const response = ErrorHandler.generateSuccessResponse(
      201,
      "Thread started successfully!",
      { threadId }
    );
    res.status(201).send(response);
  } catch (error) {
    console.error("[startThread] error:", error);
    const response = ErrorHandler.generateErrorResponse(
      500,
      error.message || "Failed to start thread."
    );
    res.status(500).send(response);
  }
};

exports.addMessage = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) {
      return res
        .status(400)
        .json(
          ErrorHandler.generateErrorResponse(400, "orgId header is required")
        );
    }

    const { thread_id } = req.params;
    const { sender_id, sender_role, message, recipient_id } = req.body;

    const attachment_url = req.file
      ? `${req.protocol}://${req.get("host")}/attachments/${req.file.filename}`
      : null;

    if (!recipient_id) {
      return res
        .status(400)
        .json(
          ErrorHandler.generateErrorResponse(400, "Recipient ID is required")
        );
    }

    const messageId = await EmployeeQueries.addMessage(
      thread_id,
      sender_id,
      sender_role,
      message,
      recipient_id,
      attachment_url,
      orgId
    );

    if (!messageId) {
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(500, "Failed to insert message")
        );
    }

    const created_at = new Date().toISOString();

    const newMessage = {
      id: messageId,
      thread_id,
      sender_id,
      sender_role,
      message,
      attachment_url,
      created_at,
    };

    const io = req.app.get("io");
    if (io) io.to(`query_${thread_id}`).emit("newMessage", newMessage);

    res.status(200).json({
      status: "success",
      code: 200,
      message: "Message added successfully",
      data: { message: newMessage },
    });
  } catch (error) {
    console.error("Error adding message:", error);
    res
      .status(500)
      .json(ErrorHandler.generateErrorResponse(500, "Failed to add message"));
  }
};

exports.getThreadMessages = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) {
      return res
        .status(400)
        .send(
          ErrorHandler.generateErrorResponse(400, "orgId header is required")
        );
    }

    const { thread_id } = req.params;
    const messages = await EmployeeQueries.getThreadMessages(thread_id, orgId);
    const response = ErrorHandler.generateSuccessResponse(
      200,
      "Messages retrieved successfully.",
      messages
    );
    res.status(200).send(response);
  } catch (error) {
    console.error("[getThreadMessages] error:", error);
    const response = ErrorHandler.generateErrorResponse(
      500,
      "Failed to retrieve messages."
    );
    res.status(500).send(response);
  }
};

exports.closeThread = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) {
      return res
        .status(400)
        .send(
          ErrorHandler.generateErrorResponse(400, "orgId header is required")
        );
    }

    const { thread_id } = req.params;
    const { feedback, note } = req.body;
    await EmployeeQueries.closeThread(thread_id, feedback, note, orgId);
    const response = ErrorHandler.generateSuccessResponse(
      200,
      "Thread closed successfully with feedback."
    );
    res.status(200).send(response);
  } catch (error) {
    console.error("[closeThread] error:", error);
    const response = ErrorHandler.generateErrorResponse(
      500,
      error.message || "Failed to close thread."
    );
    res.status(500).send(response);
  }
};

exports.getAllThreads = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) {
      return res
        .status(400)
        .send(
          ErrorHandler.generateErrorResponse(400, "orgId header is required")
        );
    }
    const threads = await EmployeeQueries.getAllThreads(orgId);
    const response = ErrorHandler.generateSuccessResponse(
      200,
      "Threads retrieved successfully.",
      threads
    );
    res.status(200).send(response);
  } catch (error) {
    console.error("[getAllThreads] error:", error);
    const response = ErrorHandler.generateErrorResponse(
      500,
      error.message || "Failed to retrieve threads."
    );
    res.status(500).send(response);
  }
};

exports.getThreadsByEmployee = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) {
      return res
        .status(400)
        .send(
          ErrorHandler.generateErrorResponse(400, "orgId header is required")
        );
    }

    const { employeeId } = req.params;
    const threads = await EmployeeQueries.getThreadsByEmployee(
      employeeId,
      orgId
    );
    res
      .status(200)
      .send(
        ErrorHandler.generateSuccessResponse(
          200,
          "Threads retrieved successfully.",
          threads
        )
      );
  } catch (err) {
    console.error("[getThreadsByEmployee] error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.markMessagesAsRead = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) {
      return res
        .status(400)
        .send(
          ErrorHandler.generateErrorResponse(400, "orgId header is required")
        );
    }

    const { thread_id } = req.params;
    const { sender_id, user_role } = req.body;
    await EmployeeQueries.markMessagesAsRead(
      thread_id,
      sender_id,
      user_role,
      orgId
    );
    const response = ErrorHandler.generateSuccessResponse(
      200,
      "Messages marked as read."
    );
    res.status(200).send(response);
  } catch (error) {
    console.error("[markMessagesAsRead] error:", error);
    const response = ErrorHandler.generateErrorResponse(
      500,
      "Failed to mark messages as read."
    );
    res.status(500).send(response);
  }
};
