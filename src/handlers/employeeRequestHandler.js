const EmployeeRequestService = require("../services/employeeRequestService");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const resolveOrgId = (req) =>
  req.headers["x-org-id"] ||
  req.headers["x_org_id"] ||
  req.body?.orgId ||
  req.query?.orgId ||
  null;

const resolveEmployeeId = (req) =>
  req.headers["x-employee-id"] || req.body?.employeeId || null;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const orgId = resolveOrgId(req);

    if (!orgId) {
      return cb(new Error("orgId is required"));
    }

    const dir = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "EmployeeRequestUploads",
      String(orgId),
    );

    fs.mkdirSync(dir, {
      recursive: true,
    });

    cb(null, dir);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);

    cb(
      null,
      `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`,
    );
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

exports.upload = upload;

exports.createRequest = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    const employeeId = resolveEmployeeId(req);

    const { requestType, title, details } = req.body;

    if (!orgId) {
      return res.status(400).json({
        message: "orgId is required",
      });
    }

    if (!employeeId) {
      return res.status(400).json({
        message: "employeeId is required",
      });
    }

    if (!requestType || !title) {
      return res.status(400).json({
        message: "requestType and title are required",
      });
    }

    let parsedDetails = details;

    if (typeof details === "string") {
      try {
        parsedDetails = JSON.parse(details);
      } catch {
        parsedDetails = {};
      }
    }

    const result = await EmployeeRequestService.createRequest({
      orgId,
      employeeId,
      requestType,
      title,
      details: parsedDetails || {},
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[EmployeeRequest] createRequest:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to create request",
    });
  }
};

exports.getMine = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    const employeeId = resolveEmployeeId(req);

    const rows = await EmployeeRequestService.getRequestsForEmployee(
      orgId,
      employeeId,
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("[EmployeeRequest] getMine:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getPending = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    const employeeId = resolveEmployeeId(req);

    const rows = await EmployeeRequestService.getPendingRequests(
      orgId,
      employeeId,
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("[EmployeeRequest] getPending:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getTravelOperations = async (req, res) => {
  try {
    const rows = await EmployeeRequestService.getTravelOperations(
      resolveOrgId(req),
      resolveEmployeeId(req),
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("[EmployeeRequest] getTravelOperations:", error);
    res.status(403).json({ success: false, message: error.message });
  }
};

exports.getSalaryAdvanceContext = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    const employeeId = resolveEmployeeId(req);
    const context = await EmployeeRequestService.getSalaryAdvanceContext(
      orgId,
      employeeId,
    );

    res.json({ success: true, data: context });
  } catch (error) {
    console.error("[EmployeeRequest] getSalaryAdvanceContext:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getDetail = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    const employeeId = resolveEmployeeId(req);

    const result = await EmployeeRequestService.getRequestDetail(
      orgId,
      req.params.requestId,
      employeeId,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[EmployeeRequest] getDetail:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.approve = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    const employeeId = resolveEmployeeId(req);

    const result = await EmployeeRequestService.approveRequest(
      orgId,
      req.params.requestId,
      employeeId,
      req.body?.comment || "",
      req.app.get("io"),
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[EmployeeRequest] approve:", error);

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.reject = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    const employeeId = resolveEmployeeId(req);

    const result = await EmployeeRequestService.rejectRequest(
      orgId,
      req.params.requestId,
      employeeId,
      req.body?.comment || "",
      req.app.get("io"),
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[EmployeeRequest] reject:", error);

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.bookTravel = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    const employeeId = resolveEmployeeId(req);

    let booking = req.body.booking || req.body;

    if (typeof booking === "string") {
      try {
        booking = JSON.parse(booking);
      } catch {
        booking = {};
      }
    }

    const result = await EmployeeRequestService.bookTravel(
      orgId,
      req.params.requestId,
      employeeId,
      booking,
      req.file || null,
      req.app.get("io"),
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[EmployeeRequest] bookTravel:", error);

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.complete = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    const employeeId = resolveEmployeeId(req);

    const result = await EmployeeRequestService.completeRequest(
      orgId,
      req.params.requestId,
      employeeId,
      req.body?.comment || "",
      req.app.get("io"),
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[EmployeeRequest] complete:", error);

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.cancel = async (req, res) => {
  try {
    const result = await EmployeeRequestService.cancelRequest(
      resolveOrgId(req),
      req.params.requestId,
      resolveEmployeeId(req),
      req.app.get("io"),
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("[EmployeeRequest] cancel:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getGuestHouses = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];

    if (!orgId) {
      return res.status(400).json({ error: "x-org-id header is required" });
    }

    const guestHouses = await EmployeeRequestService.getGuestHouses(orgId);
    res.json({ data: guestHouses });
  } catch (err) {
    console.error("getGuestHouses error:", err.message || err);
    res.status(500).json({
      error: "Failed to fetch guest houses",
      details: err.sqlMessage || err.message,
    });
  }
};
