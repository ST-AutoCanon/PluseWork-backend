const reimbursementService = require("../services/reimbursementService");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { generateDocx } = require("../services/docxService");
const { convertDocxToPdf } = require("../services/pdfService");
const db = require("../config");
const queries = require("../constants/reimbursementQueries");
const XLSX = require("xlsx");

const forbiddenExts = new Set([
  ".xlsx",
  ".xls",
  ".xlsm",
  ".csv",
  ".zip",
  ".docx",
  ".xlsb",
  ".xltx",
  ".xltm",
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const employeeId =
      (req.body && req.body.employeeId) ||
      req.query?.employeeId ||
      req.headers["x-employee-id"] ||
      req.headers["x-employeeid"] ||
      req.headers["employeeid"] ||
      (req.user && req.user.employeeId) ||
      null;

    if (!employeeId) {
      return cb(new Error("Employee ID is required"), null);
    }

    try {
      const now = new Date();
      const year = `${now.getFullYear()}`;
      const month = String(now.getMonth() + 1).padStart(2, "0");

      const basePath = path.join(
        __dirname,
        "..",
        "..",
        "..",
        "reimbursement",
        year,
        month,
        String(employeeId)
      );

      if (!fs.existsSync(basePath)) {
        fs.mkdirSync(basePath, { recursive: true });
        console.log(`Directory created: ${basePath}`);
      }

      cb(null, basePath);
    } catch (err) {
      cb(err, null);
    }
  },

  filename: (req, file, cb) => {
    try {
      const now = new Date();
      const date = now.toISOString().split("T")[0];

      const employeeId =
        (req.body && req.body.employeeId) ||
        req.query?.employeeId ||
        req.headers["x-employee-id"] ||
        req.headers["x-employeeid"] ||
        req.headers["employeeid"] ||
        (req.user && req.user.employeeId) ||
        null;

      const uploadDir = path.join(
        __dirname,
        "..",
        "..",
        "..",
        "reimbursement",
        `${now.getFullYear()}`,
        `${String(now.getMonth() + 1).padStart(2, "0")}`,
        `${employeeId || "unknown"}`
      );

      const ext = path.extname(file.originalname) || "";
      let counter = 1;
      let filename = `${date}_01${ext}`;

      if (!fs.existsSync(uploadDir)) {
        try {
          fs.mkdirSync(uploadDir, { recursive: true });
        } catch (e) {}
      }

      while (fs.existsSync(path.join(uploadDir, filename))) {
        counter++;
        filename = `${date}_${String(counter).padStart(2, "0")}${ext}`;
      }

      cb(null, filename);
    } catch (err) {
      cb(err);
    }
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (forbiddenExts.has(ext)) {
    return cb(
      new multer.MulterError(
        "LIMIT_UNEXPECTED_FILE",
        `Files of type "${ext}" are not allowed.`
      ),
      false
    );
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

function validateAttachments(files) {
  for (const file of files) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (forbiddenExts.has(ext)) {
      return `Attachment "${file.originalname}" of type "${ext}" is not allowed.`;
    }
  }
  return null;
}

function safeUnlinkSync(fp) {
  try {
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch (e) {
    console.warn("Failed to delete file:", fp, e.message);
  }
}

exports.generateReimbursementPDF = async (req, res) => {
  try {
    const { claimId } = req.params;
    if (!claimId) return res.status(400).json({ error: "claimId required" });

    const [claimRows] = await db.query(queries.GET_CLAIM_DETAILS, [claimId]);
    const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows;
    if (!claim || !claim.employee_id) {
      return res.status(404).json({ error: "Claim not found" });
    }

    const [employeeRows] = await db.query(queries.GET_EMPLOYEE_DETAILS, [
      claim.employee_id,
    ]);
    const employee = Array.isArray(employeeRows)
      ? employeeRows[0]
      : employeeRows;
    if (!employee || !employee.name) {
      return res.status(404).json({ error: "Employee details not found" });
    }

    const [attachmentsRows] = await db.query(queries.GET_ATTACHMENTS, [
      claimId,
    ]);
    const attachments = Array.isArray(attachmentsRows)
      ? attachmentsRows
      : attachmentsRows || [];

    const attachmentsWithFiles = attachments.filter(
      (att) => att && att.file_path
    );
    if (attachmentsWithFiles.length !== attachments.length) {
      console.warn(
        `Filtered out ${
          attachments.length - attachmentsWithFiles.length
        } attachments without file_path`
      );
    }

    attachmentsWithFiles.forEach((att) => {
      if (!fs.existsSync(att.file_path)) {
        console.warn(`File not found on disk: ${att.file_path}`);
      }
    });

    const [linesRows] = await db.query(queries.GET_LINES_BY_REIMBURSEMENT_IDS, [
      [claimId],
    ]);

    const lines = (linesRows || [])
      .sort((a, b) => (a.line_index || 0) - (b.line_index || 0))
      .map((l) => {
        const payload =
          typeof l.meta === "string" ? JSON.parse(l.meta) : l.meta || {};
        return {
          ...l,
          payload,
        };
      });

    const firstPayload = lines[0]?.payload || {};
    const display_date =
      firstPayload.date ||
      firstPayload.from_date ||
      firstPayload.to_date ||
      claim.date ||
      null;

    const invoiceSet = new Set();
    lines.forEach((l) => {
      (l.payload?.invoices || []).forEach(
        (i) => i && invoiceSet.add(String(i).trim())
      );
    });

    const total_amount = lines.reduce(
      (sum, l) => sum + (Number(l.total_amount) || 0),
      0
    );

    claim.lines = lines;
    claim.display_date = display_date;
    claim.total_amount = total_amount.toFixed(2);
    claim.invoices = Array.from(invoiceSet);

    const docxPath = await generateDocx(claim, employee, attachmentsWithFiles);

    const pdfPath = await convertDocxToPdf(
      docxPath,
      claim,
      attachmentsWithFiles
    );

    const fileNameBase = (employee.name || `claim_${claimId}`).replace(
      /\s+/g,
      "_"
    );
    const fileName = `${fileNameBase}.pdf`;

    res.download(pdfPath, fileName, (err) => {
      if (err) console.error("Download error:", err);
      safeUnlinkSync(docxPath);
      safeUnlinkSync(pdfPath);
    });
  } catch (error) {
    console.error("Error generating reimbursement PDF:", error);
    res.status(500).json({ error: "Failed to generate document" });
  }
};

exports.getReimbursementsByEmployee = async (req, res) => {
  try {
    const employeeId = req.params.employeeId;
    const { fromDate, toDate } = req.query;
    if (!employeeId)
      return res.status(400).json({ message: "employeeId required" });

    const reimbursements =
      await reimbursementService.getReimbursementsByEmployee(
        employeeId,
        fromDate,
        toDate
      );
    res.status(200).json(reimbursements);
  } catch (error) {
    console.error("Error fetching reimbursements:", error);
    res.status(500).json({ message: "Failed to fetch reimbursements" });
  }
};

exports.updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    let { payment_status, user_role } = req.body;

    if (!id) return res.status(400).json({ error: "id required" });

    if (
      !["pending", "paid", "rejected"].includes(
        String(payment_status).toLowerCase()
      )
    ) {
      return res.status(400).json({ error: "Invalid payment status." });
    }

    if (String(user_role).toLowerCase() === "employee") {
      return res.status(403).json({ error: "Not authorized." });
    }

    const [rows] = await db.query(
      "SELECT status FROM reimbursement WHERE id = ?",
      [id]
    );
    const statusVal =
      rows && rows[0] && rows[0].status
        ? String(rows[0].status).toLowerCase()
        : null;
    if (!statusVal || statusVal !== "approved") {
      return res.status(400).json({
        error:
          "Payment status can only be updated for approved reimbursements.",
      });
    }

    const paid_date =
      String(payment_status).toLowerCase() === "paid" ? new Date() : null;
    const updated = await reimbursementService.updatePaymentStatus(
      id,
      String(payment_status).toLowerCase(),
      paid_date
    );

    res.json({ message: "Payment status updated", data: updated });
  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({ error: "Error updating payment status" });
  }
};

exports.getAllReimbursements = async (req, res) => {
  try {
    let { submittedFrom, submittedTo } = req.query;
    submittedFrom =
      submittedFrom && submittedFrom !== "null" ? submittedFrom : null;
    submittedTo = submittedTo && submittedTo !== "null" ? submittedTo : null;

    const reimbursements = await reimbursementService.getAllReimbursements(
      submittedFrom,
      submittedFrom,
      submittedTo
    );
    res.status(200).json(reimbursements);
  } catch (error) {
    console.error("Error fetching all reimbursements:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.exportReimbursements = async (req, res) => {
  try {
    let { submittedFrom, submittedTo } = req.query;
    submittedFrom = submittedFrom !== "null" ? submittedFrom : null;
    submittedTo = submittedTo !== "null" ? submittedTo : null;

    const rows = await reimbursementService.getAllReimbursements(
      submittedFrom,
      submittedFrom,
      submittedTo
    );

    const flat = rows.reduce((acc, r) => acc.concat(r.claims || []), []);

    const ws = XLSX.utils.json_to_sheet(flat);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reimbursements");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const fname = `Reimbursements_${submittedFrom || "all"}-to-${
      submittedTo || "all"
    }.xlsx`;

    res
      .setHeader("Content-Disposition", `attachment; filename="${fname}"`)
      .setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
      .send(buf);
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ error: "Failed to export Excel" });
  }
};

function safeParseJSON(val, fallback = null) {
  if (val === undefined || val === null) return fallback;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch (e) {
    return fallback;
  }
}

function buildLinesFromRequest({
  claim_type,
  linesInput,
  claim_rows_input,
  transport_type,
}) {
  if (Array.isArray(linesInput) && linesInput.length) {
    return linesInput.map((l, idx) => {
      const payload = l.payload || { ...(l || {}) };
      const total =
        l.total_amount !== undefined && l.total_amount !== null
          ? Number(l.total_amount)
          : computeRowTotal(payload, transport_type);
      return {
        line_type: l.line_type || claim_type || null,
        payload,
        total_amount: Number(
          (total || 0).toFixed ? total.toFixed(2) : parseFloat(total) || 0
        ),
      };
    });
  }

  if (claim_rows_input && typeof claim_rows_input === "object") {
    const rowsForType = Array.isArray(claim_rows_input[claim_type])
      ? claim_rows_input[claim_type]
      : [];
    return rowsForType.map((r) => {
      const payload = { ...(r || {}) };
      const total =
        r && r.total_amount !== undefined && r.total_amount !== null
          ? Number(r.total_amount)
          : computeRowTotal(payload, transport_type);
      return {
        line_type: claim_type || null,
        payload,
        total_amount: Number(
          (total || 0).toFixed ? total.toFixed(2) : parseFloat(total) || 0
        ),
      };
    });
  }

  return [];
}

function computeRowTotal(payload = {}, transport_type) {
  const t =
    payload &&
    payload.total_amount !== undefined &&
    payload.total_amount !== null
      ? parseFloat(payload.total_amount) || 0
      : 0;

  if (transport_type === "Outstation") {
    const ta = parseFloat(payload.transport_amount) || 0;
    const af = parseFloat(payload.accommodation_fees) || 0;
    const da = parseFloat(payload.da) || 0;
    const sum = ta + af + da;
    return Number.isFinite(sum) ? sum : t;
  }

  if (t > 0) return t;
  const ta = parseFloat(payload.transport_amount) || 0;
  return ta;
}

function buildAttachmentsFromFiles(reqFiles = [], attachmentsMeta = {}) {
  if (!Array.isArray(reqFiles) || reqFiles.length === 0) return [];
  return reqFiles.map((f) => {
    const fileName = f.filename || f.originalname;
    const lineIndex =
      attachmentsMeta && attachmentsMeta[fileName] !== undefined
        ? attachmentsMeta[fileName]
        : attachmentsMeta && attachmentsMeta[f.originalname] !== undefined
        ? attachmentsMeta[f.originalname]
        : undefined;
    return {
      file_name: fileName,
      file_path: f.path,
      line_index: typeof lineIndex === "number" ? Number(lineIndex) : undefined,
    };
  });
}

exports.createReimbursement = async (req, res) => {
  try {
    if (req.files && req.files.length) {
      const errMsg = validateAttachments(req.files);
      if (errMsg) {
        req.files.forEach((f) => safeUnlinkSync(f.path));
        return res.status(400).json({ error: errMsg });
      }
    }

    const employeeId = req.user?.employeeId || req.body.employeeId;
    const role = req.user?.role || req.body.role;
    if (!employeeId || employeeId === "undefined") {
      if (req.files && req.files.length)
        req.files.forEach((f) => safeUnlinkSync(f.path));
      return res.status(400).json({ error: "Employee ID missing." });
    }

    let participants = [];
    if (req.body.participants) {
      participants = safeParseJSON(req.body.participants, []);
      if (!Array.isArray(participants)) participants = [];
    }

    let invoices = [];
    if (req.body.invoices) {
      invoices = safeParseJSON(req.body.invoices, []);
      if (!Array.isArray(invoices) && typeof req.body.invoices === "string") {
        invoices = req.body.invoices
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (!Array.isArray(invoices)) invoices = [];
    }

    let attachmentsMeta = {};
    if (req.body.attachmentsMeta) {
      attachmentsMeta = safeParseJSON(req.body.attachmentsMeta, {});
      if (!attachmentsMeta || typeof attachmentsMeta !== "object")
        attachmentsMeta = {};
    }

    const linesInput = safeParseJSON(req.body.lines, null);
    const claim_rows_input = safeParseJSON(req.body.claim_rows, null);
    const claim_type = req.body.claim_type || null;
    const transport_type = req.body.transport_type || null;

    const lines = buildLinesFromRequest({
      claim_type,
      linesInput,
      claim_rows_input,
      transport_type,
    });

    const attachmentsFromFiles = buildAttachmentsFromFiles(
      req.files || [],
      attachmentsMeta
    );

    let attachmentsFromBody = [];
    if (req.body.attachments && typeof req.body.attachments !== "undefined") {
      const parsed = safeParseJSON(req.body.attachments, null);
      if (Array.isArray(parsed)) {
        attachmentsFromBody = parsed.map((a) => ({
          file_name: a.file_name || a.filename || a.name,
          file_path: a.file_path || a.path || null,
          line_index:
            a.line_index !== undefined ? Number(a.line_index) : undefined,
        }));
      }
    }

    const attachments = [...attachmentsFromFiles, ...attachmentsFromBody];

    const reimbursementData = {
      employeeId,
      department_id: role === "Admin" ? null : req.body.department_id,
      claim_type: claim_type,
      transport_type: transport_type,
      project: req.body.project || null,
      participants: participants,
      comments: req.body.comments || req.body.purpose || null,
      lines,
      attachments,
      invoices,
    };

    const newReimbursement = await reimbursementService.createReimbursement(
      reimbursementData
    );

    if (role === "Admin") {
      const approverId = req.user?.employeeId || "Admin";
      await reimbursementService.updateReimbursementStatus(
        newReimbursement.id,
        "approved",
        "Auto-approved by Admin",
        approverId,
        "Admin",
        "Administrator"
      );
    }

    res.status(201).json({
      message: "Reimbursement request submitted successfully",
      data: newReimbursement,
    });
  } catch (error) {
    console.error("Error creating reimbursement:", error);
    if (req.files && req.files.length) {
      req.files.forEach((f) => safeUnlinkSync(f.path));
    }
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Error creating reimbursement" });
  }
};

exports.updateReimbursement = async (req, res) => {
  try {
    if (req.files && req.files.length) {
      const errMsg = validateAttachments(req.files);
      if (errMsg) {
        req.files.forEach((f) => safeUnlinkSync(f.path));
        return res.status(400).json({ error: errMsg });
      }
    }

    const { id } = req.params;
    if (!id)
      return res.status(400).json({ error: "Reimbursement id required" });

    const role = req.user?.role || req.body.role;

    let participants = [];
    if (req.body.participants) {
      participants = safeParseJSON(req.body.participants, []);
      if (!Array.isArray(participants)) participants = [];
    }

    let invoices = [];
    if (req.body.invoices) {
      invoices = safeParseJSON(req.body.invoices, []);
      if (!Array.isArray(invoices) && typeof req.body.invoices === "string") {
        invoices = req.body.invoices
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (!Array.isArray(invoices)) invoices = [];
    }

    let attachmentsMeta = {};
    if (req.body.attachmentsMeta) {
      attachmentsMeta = safeParseJSON(req.body.attachmentsMeta, {});
      if (!attachmentsMeta || typeof attachmentsMeta !== "object")
        attachmentsMeta = {};
    }

    let attachmentsFromBody = [];
    if (req.body.attachments && typeof req.body.attachments !== "undefined") {
      const parsed = safeParseJSON(req.body.attachments, null);
      if (Array.isArray(parsed)) {
        attachmentsFromBody = parsed
          .map((a) => ({
            file_name: a.file_name || a.filename || a.name,
            file_path: a.file_path || a.path || null,
            line_index:
              a.line_index !== undefined ? Number(a.line_index) : undefined,
          }))
          .filter((a) => a.file_name);
      }
    }

    let attachmentsFromExisting = [];
    if (req.body.existingAttachments) {
      const parsedExisting = safeParseJSON(req.body.existingAttachments, null);
      if (Array.isArray(parsedExisting)) {
        attachmentsFromExisting = parsedExisting
          .map((entry) => {
            if (typeof entry === "string") {
              return { file_name: entry, file_path: null };
            }
            return {
              file_name:
                entry.file_name || entry.filename || entry.name || null,
              file_path: entry.file_path || entry.path || null,
              line_index:
                entry.line_index !== undefined
                  ? Number(entry.line_index)
                  : undefined,
            };
          })
          .filter((a) => a.file_name);
      }
    }

    const linesInput = safeParseJSON(req.body.lines, null);
    const claim_rows_input = safeParseJSON(req.body.claim_rows, null);
    const claim_type = req.body.claim_type || null;
    const transport_type = req.body.transport_type || null;

    const lines = buildLinesFromRequest({
      claim_type,
      linesInput,
      claim_rows_input,
      transport_type,
    });

    const attachmentsFromFiles = buildAttachmentsFromFiles(
      req.files || [],
      attachmentsMeta
    );

    const attachments = [
      ...attachmentsFromFiles,
      ...attachmentsFromBody,
      ...attachmentsFromExisting,
    ];

    const updateData = {
      employeeId: req.body.employeeId,
      department_id:
        role === "Admin"
          ? null
          : req.body.department_id !== undefined
          ? parseInt(req.body.department_id, 10)
          : null,
      claim_type: claim_type,
      transport_type: transport_type || null,
      project: req.body.project || null,
      comments:
        req.body.comments !== "undefined"
          ? req.body.comments
          : req.body.purpose || "",
      participants,
      lines,
      attachments,
      invoices,
    };

    const updatedReimbursement = await reimbursementService.updateReimbursement(
      id,
      updateData
    );

    res.json({ message: "Reimbursement updated", data: updatedReimbursement });
  } catch (error) {
    console.error("Error updating reimbursement:", error);
    if (req.files && req.files.length) {
      req.files.forEach((f) => safeUnlinkSync(f.path));
    }
    res.status(500).json({ error: "Error updating reimbursement" });
  }
};

exports.updateReimbursementStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approver_comments, approver_id, project } = req.body;
    if (!id) return res.status(400).json({ error: "id required" });
    if (!["approved", "rejected"].includes(String(status).toLowerCase())) {
      return res.status(400).json({ error: "Invalid status." });
    }

    const approverDetails = await reimbursementService.getApproverDetails(
      approver_id
    );

    let approver_name = null;
    let approver_designation = null;
    if (approverDetails) {
      const row = Array.isArray(approverDetails)
        ? approverDetails[0]
        : approverDetails;
      approver_name = row?.name || row?.employee_name || null;
      approver_designation = row?.role || row?.designation || null;
    }

    const updatedStatus = await reimbursementService.updateReimbursementStatus(
      id,
      String(status).toLowerCase(),
      approver_comments,
      approver_id,
      approver_name,
      approver_designation,
      project
    );

    res.json({ message: `Reimbursement ${status}`, data: updatedStatus });
  } catch (error) {
    console.error("Error updating reimbursement status:", error);
    res.status(500).json({ error: "Error updating reimbursement status" });
  }
};

exports.deleteReimbursement = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "id required" });

    await reimbursementService.deleteReimbursement(id);
    res.json({ message: "Reimbursement deleted" });
  } catch (error) {
    console.error("Error deleting reimbursement:", error);
    res.status(500).json({ error: "Error deleting reimbursement" });
  }
};

exports.uploadReimbursementAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    res.json({
      message: "File uploaded successfully",
      filename: req.file.filename,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ error: "Error uploading file" });
  }
};

exports.getAttachments = async (req, res) => {
  try {
    const { year, month, employeeId, filename } = req.params;
    if (!year || !month || !employeeId || !filename) {
      return res.status(400).json({ error: "Missing path parameters" });
    }

    if (
      [year, month, employeeId, filename].some(
        (p) => p.includes("..") || p.includes("/") || p.includes("\\")
      )
    ) {
      return res.status(400).json({ error: "Invalid filename" });
    }

    const filePath = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "reimbursement",
      year,
      month,
      employeeId,
      filename
    );
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filename).toLowerCase();
      const mimeType =
        {
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".pdf": "application/pdf",
        }[ext] || "application/octet-stream";

      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.status(404).json({ error: "File not found" });
    }
  } catch (error) {
    console.error("Error fetching file:", error);
    res.status(500).json({ error: "Error fetching file" });
  }
};

exports.getAttachmentsByReimbursementId = async (req, res) => {
  try {
    const { reimbursementId } = req.params;
    if (!reimbursementId) {
      return res.status(400).json({ message: "Reimbursement ID is required" });
    }

    const attachments =
      await reimbursementService.getAttachmentsByReimbursementIds([
        reimbursementId,
      ]);
    if (!attachments || attachments.length === 0) {
      return res.status(404).json({ message: "No attachments found." });
    }
    res.json({ attachments });
  } catch (error) {
    console.error("Error fetching attachments:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getEmployees = async (req, res) => {
  try {
    const { q, departmentId, limit } = req.query;

    const employees = await reimbursementService.getEmployees(
      q || null,
      departmentId || null,
      limit || 200
    );

    res.status(200).json(employees);
  } catch (err) {
    console.error("Error fetching employees:", err);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
};
exports.getTeamReimbursements = async (req, res) => {
  try {
    const { teamLeadId } = req.params;
    const { departmentId } = req.query;
    let { submittedFrom, submittedTo } = req.query;

    if (!teamLeadId) {
      return res.status(400).json({ error: "Team Lead ID is required" });
    }
    if (!departmentId) {
      return res.status(400).json({ error: "Department ID is required" });
    }

    const start =
      submittedFrom && submittedFrom !== "null" ? submittedFrom : null;
    const end = submittedTo && submittedTo !== "null" ? submittedTo : null;

    const teamReimbursements = await reimbursementService.getTeamReimbursements(
      departmentId,
      start,
      end,
      teamLeadId
    );
    res.status(200).json(teamReimbursements);
  } catch (error) {
    console.error("Error fetching team reimbursements:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getAllProjects = async (req, res) => {
  try {
    const projects = await reimbursementService.getAllProjects();
    res.status(200).json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.upload = upload;
