// src/services/reimbursementService.js
const queries = require("../constants/reimbursementQueries");
const path = require("path");
const fs = require("fs").promises;

const { sanitizeDbName, getTenantPool } = require("../db/tenantPoolManager");

const XLSX = require("xlsx");

const toLocalDateString = (dt) => {
  if (!dt) return null;
  const d = new Date(dt);
  if (isNaN(d)) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const normalizeRow = (r) => ({
  ...r,
  status: r.status ? String(r.status).toLowerCase().trim() : "",
  payment_status: r.payment_status
    ? String(r.payment_status).toLowerCase().trim()
    : "",
});

const parseInvoices = (val) => {
  if (!val && val !== 0) return [];
  if (Array.isArray(val))
    return val.map((v) => String(v).trim()).filter(Boolean);
  try {
    const s = typeof val === "string" ? val : JSON.stringify(val);
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed))
      return parsed.map((v) => String(v).trim()).filter(Boolean);
    if (typeof parsed === "string") {
      return parsed
        .split(",")
        .map((v) => String(v).trim())
        .filter(Boolean);
    }
    return [];
  } catch (e) {
    try {
      if (typeof val === "string" && val.includes(",")) {
        return val
          .split(",")
          .map((v) => String(v).trim())
          .filter(Boolean);
      }
    } catch (_) {}
    return [];
  }
};

const parseParticipants = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = typeof val === "string" ? JSON.parse(val) : val;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const parseParticipantsSafe = (val) => {
  if (!val) return [];

  if (Array.isArray(val)) return val;

  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}

    return val
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  return [];
};

function coerceNullableNumber(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function getTenantPoolForOrgId(orgId) {
  if (!orgId) {
    const err = new Error("orgId required");
    err.code = "ORG_REQUIRED";
    throw err;
  }
  const dbName = `tenant_${sanitizeDbName(orgId)}`;
  return getTenantPool(dbName);
}

/**
 * buildAttachmentUrl
 * NOTE: we no longer persist file_path in DB. Build a URL or return the filename.
 * You can update this to return a full backend endpoint if you have a route like:
 *  GET /reimbursement/:orgId/:year/:month/:employeeId/:filename
 */
const buildAttachmentUrl = (fileName, employeeIdHint = null) => {
  try {
    const fname = String(fileName || "").trim();
    if (!fname) return null;
    // If you have a route on backend to serve attachments by filename, build and return it here.
    // For now just return the filename so the frontend can call your serve endpoint and pass orgId/employee/etc.
    return fname;
  } catch (e) {
    return null;
  }
};

const buildAttachmentsFromFiles = (files = [], attachmentsMeta = {}) => {
  if (!Array.isArray(files) || files.length === 0) return [];

  return files.map((file) => {
    const diskName =
      file.filename ||
      (file.path ? path.basename(file.path) : null) ||
      file.originalname ||
      "";
    const originalName = file.originalname || diskName || "";

    let lineIndex;
    if (
      attachmentsMeta &&
      Object.prototype.hasOwnProperty.call(attachmentsMeta, originalName)
    ) {
      lineIndex = attachmentsMeta[originalName];
    } else if (
      attachmentsMeta &&
      Object.prototype.hasOwnProperty.call(attachmentsMeta, diskName)
    ) {
      lineIndex = attachmentsMeta[diskName];
    } else {
      lineIndex = undefined;
    }

    // IMPORTANT: we only persist filename and optional line index
    return {
      file_name: String(diskName || originalName || "").trim(),
      file_path: file.path || null, // keep in-memory if handler wants to use it for uploading; NOT stored in DB
      line_index:
        typeof lineIndex !== "undefined" && lineIndex !== null
          ? Number(lineIndex)
          : undefined,
    };
  });
};

/**
 * saveAttachmentsBulk
 * Now inserts only (reimbursement_id, line_id, file_name) to match existing DB schema.
 */
const saveAttachmentsBulk = async (reimbursementId, files = [], orgId) => {
  if (!files || !files.length) return;
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const attachmentValues = files.map((f) => [
    reimbursementId,
    f.line_id !== undefined && f.line_id !== null ? f.line_id : null,
    f.file_name,
  ]);
  await tenantPool.query(queries.SAVE_ATTACHMENTS, [attachmentValues]);
};

/**
 * processUploadedFiles
 * Normalize incoming uploaded files and persist DB rows for them (3-column).
 * Returns normalized array (with file_name, file_path (in-memory), line_index).
 */
exports.processUploadedFiles = async (
  files,
  reimbursementId,
  attachmentsMeta = {},
  orgId,
) => {
  if (!files || !files.length) return [];
  try {
    const normalized = files.map((file) => {
      const diskName =
        file.filename ||
        (file.path ? path.basename(file.path) : "") ||
        file.originalname ||
        "";
      const originalName = file.originalname || diskName;
      let lineIndex;
      if (
        attachmentsMeta &&
        Object.prototype.hasOwnProperty.call(attachmentsMeta, originalName)
      ) {
        lineIndex = attachmentsMeta[originalName];
      } else if (
        attachmentsMeta &&
        Object.prototype.hasOwnProperty.call(attachmentsMeta, diskName)
      ) {
        lineIndex = attachmentsMeta[diskName];
      } else {
        lineIndex = undefined;
      }

      return {
        file_name: String(diskName || originalName || "").trim(),
        file_path: file.path || null, // kept in-memory for potential immediate processing, NOT stored as DB column
        line_index:
          typeof lineIndex !== "undefined" && lineIndex !== null
            ? Number(lineIndex)
            : undefined,
      };
    });

    // Convert to DB rows shape: reimbursement_id, line_id, file_name
    const toSave = normalized.map((n) => ({
      file_name: n.file_name,
      line_id: n.line_index !== undefined ? n.line_index : null,
    }));

    if (toSave.length) {
      // Save using the 3-column insert
      await saveAttachmentsBulk(
        reimbursementId,
        toSave.map((t) => ({ line_id: t.line_id, file_name: t.file_name })),
        orgId,
      );
    }

    return normalized;
  } catch (err) {
    console.error("Error in processUploadedFiles:", err);
    throw err;
  }
};

exports.getReimbursementsByEmployee = async (
  employeeId,
  fromDate = null,
  toDate = null,
  orgId,
) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(
    queries.GET_REIMBURSEMENTS_BY_EMPLOYEE,
    [employeeId],
  );
  if (!rows || rows.length === 0) return [];

  const reimbursements = rows.map((r) => ({
    ...r,
    participants: parseParticipantsSafe(r.participants),
    aggregated_total: r.aggregated_total,
  }));
  const ids = reimbursements.map((r) => r.id);
  const safeIds = ids.length ? ids : [-1];

  const [linesRows] = await tenantPool.query(
    queries.GET_LINES_BY_REIMBURSEMENT_IDS,
    [safeIds],
  );
  const [attachRows] = await tenantPool.query(
    queries.GET_ATTACHMENTS_BY_REIMBURSEMENT_IDS,
    [safeIds],
  );

  const linesByReim = {};
  linesRows.forEach((l) => {
    let parsedMeta = {};
    if (l.meta !== undefined && l.meta !== null) {
      if (typeof l.meta === "string") {
        try {
          parsedMeta = JSON.parse(l.meta);
        } catch (e) {
          console.warn("Failed to parse l.meta:", e?.message || e, l.meta);
          parsedMeta = {};
        }
      } else if (typeof l.meta === "object") {
        parsedMeta = l.meta;
      }
    }

    const payload = {
      ...parsedMeta,
      purpose: parsedMeta.purpose || l.purpose || null,
      date: parsedMeta.date || (l.date ? toLocalDateString(l.date) : null),
      from_date:
        parsedMeta.from_date ||
        (l.from_date ? toLocalDateString(l.from_date) : null),
      to_date:
        parsedMeta.to_date || (l.to_date ? toLocalDateString(l.to_date) : null),
      travel_from: parsedMeta.travel_from || l.travel_from || null,
      travel_to: parsedMeta.travel_to || l.travel_to || null,

      transport_amount:
        parsedMeta.transport_amount ??
        (l.transport_amount !== null ? parseFloat(l.transport_amount) : null),
      accommodation_fees:
        parsedMeta.accommodation_fees ??
        (l.accommodation_fees !== null
          ? parseFloat(l.accommodation_fees)
          : null),
      da: parsedMeta.da ?? (l.da !== null ? parseFloat(l.da) : null),
      total_amount:
        parsedMeta.total_amount ??
        (l.total_amount !== null ? parseFloat(l.total_amount) : null),

      meal_type: parsedMeta.meal_type || l.meal_type || null,
      meals_objective: parsedMeta.meals_objective || l.meals_objective || null,
      purchasing_item: parsedMeta.purchasing_item || l.purchasing_item || null,
      stationairy_item:
        parsedMeta.stationairy_item || l.stationairy_item || null,
      service_provider:
        parsedMeta.service_provider || l.service_provider || null,

      invoices: parseInvoices(parsedMeta.invoices),
      attachments: Array.isArray(parsedMeta.attachments)
        ? parsedMeta.attachments
        : parsedMeta.attachments
          ? [parsedMeta.attachments]
          : [],
    };

    if (!linesByReim[l.reimbursement_id]) linesByReim[l.reimbursement_id] = [];
    linesByReim[l.reimbursement_id].push({
      id: l.id,
      line_index: l.line_index,
      line_type: l.line_type || null,
      payload,
      total_amount: parseFloat(l.total_amount || 0).toFixed(2),
    });
  });

  const attByReim = {};
  attachRows.forEach((a) => {
    if (!attByReim[a.reimbursement_id]) attByReim[a.reimbursement_id] = [];
    const url = buildAttachmentUrl(a.file_name, employeeId);
    attByReim[a.reimbursement_id].push({
      id: a.id,
      line_id: a.line_id,
      file_name: a.file_name,
      url: url,
      // no file_path persisted
    });
  });

  const result = reimbursements.map((r) => ({
    ...r,
    lines: linesByReim[r.id] || [],
    attachments: (attByReim[r.id] || []).filter((a) => !a.line_id),
    line_attachments_map: (attByReim[r.id] || [])
      .filter((a) => a.line_id)
      .reduce((acc, a) => {
        if (!acc[a.line_id]) acc[a.line_id] = [];
        acc[a.line_id].push(a);
        return acc;
      }, {}),
  }));

  return result;
};

exports.getAllReimbursements = async (
  submittedFrom = null,
  submittedFromForBetween = null,
  submittedTo = null,
  orgId,
) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  try {
    const params = [
      submittedFrom || null,
      submittedFromForBetween || null,
      submittedTo || null,
    ];
    const [rawRows] = await tenantPool.query(
      queries.GET_ALL_REIMBURSEMENTS,
      params,
    );

    if (!rawRows || rawRows.length === 0) return [];

    const reimbursements = rawRows.map((r) => {
      const n = normalizeRow(r);
      const participants = parseParticipantsSafe(r.participants);
      const invoices = parseInvoices(r.invoices);
      return {
        ...n,
        participants,
        invoices,
        from_date: toLocalDateString(r.from_date),
        to_date: toLocalDateString(r.to_date),
        date: toLocalDateString(r.date),
      };
    });

    const reimbursementIds = reimbursements.map((r) => r.id);
    const safeIds = reimbursementIds.length ? reimbursementIds : [-1];

    const [linesRows] = await tenantPool.query(
      queries.GET_LINES_BY_REIMBURSEMENT_IDS,
      [safeIds],
    );
    const [attachRows] = await tenantPool.query(
      queries.GET_ATTACHMENTS_BY_REIMBURSEMENT_IDS,
      [safeIds],
    );

    const linesByReim = {};
    (linesRows || []).forEach((l) => {
      let parsedMeta = {};
      try {
        parsedMeta = l.meta
          ? typeof l.meta === "string"
            ? JSON.parse(l.meta)
            : l.meta
          : {};
      } catch (e) {
        parsedMeta = {};
        console.warn("Failed to parse line.meta:", e?.message || e, l.meta);
      }

      const payload = {
        ...parsedMeta,
        purpose: parsedMeta.purpose || l.purpose || null,
        date: parsedMeta.date || (l.date ? toLocalDateString(l.date) : null),
        from_date:
          parsedMeta.from_date ||
          (l.from_date ? toLocalDateString(l.from_date) : null),
        to_date:
          parsedMeta.to_date ||
          (l.to_date ? toLocalDateString(l.to_date) : null),
        travel_from: parsedMeta.travel_from || l.travel_from || null,
        travel_to: parsedMeta.travel_to || l.travel_to || null,

        transport_amount:
          parsedMeta.transport_amount ??
          (l.transport_amount !== null ? parseFloat(l.transport_amount) : null),
        accommodation_fees:
          parsedMeta.accommodation_fees ??
          (l.accommodation_fees !== null
            ? parseFloat(l.accommodation_fees)
            : null),
        da: parsedMeta.da ?? (l.da !== null ? parseFloat(l.da) : null),
        total_amount:
          parsedMeta.total_amount ??
          (l.total_amount !== null ? parseFloat(l.total_amount) : null),

        meal_type: parsedMeta.meal_type || l.meal_type || null,
        meals_objective:
          parsedMeta.meals_objective || l.meals_objective || null,
        purchasing_item:
          parsedMeta.purchasing_item || l.purchasing_item || null,
        stationairy_item:
          parsedMeta.stationairy_item || l.stationairy_item || null,
        service_provider:
          parsedMeta.service_provider || l.service_provider || null,

        invoices: parseInvoices(parsedMeta.invoices),
        attachments: Array.isArray(parsedMeta.attachments)
          ? parsedMeta.attachments
          : parsedMeta.attachments
            ? [parsedMeta.attachments]
            : [],
      };

      if (!linesByReim[l.reimbursement_id])
        linesByReim[l.reimbursement_id] = [];
      linesByReim[l.reimbursement_id].push({
        id: l.id,
        line_index: l.line_index,
        line_type: l.line_type || null,
        payload,
        total_amount: parseFloat(l.total_amount || 0).toFixed(2),
      });
    });

    const attByReim = {};
    (attachRows || []).forEach((a) => {
      if (!attByReim[a.reimbursement_id]) attByReim[a.reimbursement_id] = [];
      const url = buildAttachmentUrl(
        a.file_name,
        a.file_name,
        a.employee_id || null,
      );
      attByReim[a.reimbursement_id].push({
        id: a.id,
        line_id: a.line_id,
        file_name: a.file_name,
        file_path: undefined, // not persisted
        url,
      });
    });

    const finalReims = reimbursements.map((r) => {
      const lines = (linesByReim[r.id] || []).sort(
        (x, y) => (x.line_index || 0) - (y.line_index || 0),
      );
      const attList = attByReim[r.id] || [];

      const claimLevelAttachments = attList
        .filter((a) => !a.line_id)
        .map((a) => ({
          id: a.id,
          file_name: a.file_name,
          file_path: undefined,
          url: buildAttachmentUrl(a.file_name, r.employee_id),
        }));

      const line_attachments_map = attList
        .filter((a) => a.line_id)
        .reduce((acc, a) => {
          if (!acc[a.line_id]) acc[a.line_id] = [];
          acc[a.line_id].push({
            id: a.id,
            line_id: a.line_id,
            file_name: a.file_name,
            file_path: undefined,
            url: buildAttachmentUrl(a.file_name, r.employee_id),
          });
          return acc;
        }, {});

      const invoiceSet = new Set();
      (Array.isArray(r.invoices)
        ? r.invoices
        : parseInvoices(r.invoices)
      ).forEach((inv) => inv && invoiceSet.add(String(inv).trim()));
      (lines || []).forEach((ln) => {
        const linv = ln?.payload?.invoices || [];
        (Array.isArray(linv) ? linv : parseInvoices(linv)).forEach((inv) => {
          if (inv) invoiceSet.add(String(inv).trim());
        });
      });
      const aggregatedInvoices = Array.from(invoiceSet);

      return {
        ...r,
        lines,
        attachments: claimLevelAttachments,
        line_attachments_map,
        invoices: aggregatedInvoices,
      };
    });

    const grouped = finalReims.reduce((acc, r) => {
      const eid = r.employee_id;
      if (!acc[eid]) acc[eid] = [];
      acc[eid].push(r);
      return acc;
    }, {});

    return Object.entries(grouped).map(([employee_id, claims]) => ({
      employee_id,
      claims,
    }));
  } catch (err) {
    console.error("Error in getAllReimbursements:", err);
    throw err;
  }
};

exports.getEmployees = async (
  q = null,
  departmentId = null,
  limit = 200,
  orgId,
) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  try {
    let sql =
      queries.GET_EMPLOYEES ||
      `
      SELECT e.employee_id,
             CONCAT(e.first_name, ' ', e.last_name) AS name,
             ep.position,
             d.name as department_name
      FROM employees e
      LEFT JOIN employee_professional ep ON e.employee_id = ep.employee_id
      LEFT JOIN departments d ON ep.department_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (
      departmentId !== undefined &&
      departmentId !== null &&
      String(departmentId).trim() !== ""
    ) {
      sql += " AND ep.department_id = ?";
      params.push(departmentId);
    }

    if (q && String(q).trim() !== "") {
      const like = `%${String(q).trim()}%`;
      sql += ` AND (
        e.employee_id LIKE ?
        OR e.first_name LIKE ?
        OR e.last_name LIKE ?
        OR CONCAT(e.first_name, ' ', e.last_name) LIKE ?
      )`;
      params.push(like, like, like, like);
    }

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 2000);
    sql += " ORDER BY e.first_name ASC LIMIT ?";
    params.push(safeLimit);

    const [rows] = await tenantPool.query(sql, params);
    const list = (rows || []).map((r) => ({
      employee_id: r.employee_id,
      name: r.name || `${r.first_name || ""} ${r.last_name || ""}`.trim(),
      position: r.position || null,
      department_name: r.department_name || null,
    }));
    return list;
  } catch (err) {
    console.error("Error in getEmployees:", err);
    throw err;
  }
};

exports.createReimbursement = async (reimbursementData, orgId) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();
  try {
    await conn.beginTransaction();

    // Check for duplicate invoices before creating
    if (
      Array.isArray(reimbursementData.invoices) &&
      reimbursementData.invoices.length > 0
    ) {
      for (const invoice of reimbursementData.invoices) {
        if (!invoice || typeof invoice !== "string") continue;
        const trimmedInvoice = invoice.trim();
        if (!trimmedInvoice) continue;

        const [existing] = await conn.query(queries.CHECK_INVOICE_DUPLICATE, [
          trimmedInvoice,
        ]);
        if (existing && existing.length > 0) {
          const duplicateClaim = existing[0];
          throw new Error(
            `Duplicate invoice detected: "${trimmedInvoice}" is already used in reimbursement ID ${duplicateClaim.reimbursement_id}. Please use a unique invoice number.`,
          );
        }
      }
    }

    const participantsArr = parseParticipants(reimbursementData.participants);
    const participantsJSON = JSON.stringify(participantsArr);

    const lines = Array.isArray(reimbursementData.lines)
      ? reimbursementData.lines
      : [];

    const aggregated_total = lines.reduce(
      (s, l) => s + (parseFloat(l.total_amount) || 0),
      0,
    );

    const [res] = await conn.query(queries.CREATE_REIMBURSEMENT, [
      reimbursementData.employeeId,
      reimbursementData.department_id || null,
      reimbursementData.claim_type || null,
      reimbursementData.transport_type || null,
      reimbursementData.project || null,
      participantsJSON,
      reimbursementData.comments || null,
      aggregated_total,
    ]);
    const reimbursementId = res.insertId;

    if (lines.length) {
      const now = new Date();
      const values = lines.map((l, idx) => {
        const payload =
          l.payload && typeof l.payload === "object" ? l.payload : {};

        // Include main invoices in the first line's meta
        if (
          idx === 0 &&
          Array.isArray(reimbursementData.invoices) &&
          reimbursementData.invoices.length > 0
        ) {
          payload.invoices = reimbursementData.invoices;
        }

        const purpose = payload.purpose || null;
        const date = payload.date || null;
        const from_date = payload.from_date || payload.fromDate || null;
        const to_date = payload.to_date || payload.toDate || null;
        const travel_from = payload.travel_from || payload.travelFrom || null;
        const travel_to = payload.travel_to || payload.travelTo || null;
        const transport_amount = coerceNullableNumber(
          payload.transport_amount ?? payload.transportAmount ?? null,
        );
        const accommodation_fees = coerceNullableNumber(
          payload.accommodation_fees ?? payload.accommodationFees ?? null,
        );
        const da = coerceNullableNumber(payload.da ?? null);
        const total_amount = (
          parseFloat(l.total_amount || payload.total_amount || 0) || 0
        ).toFixed(2);
        const meal_type = payload.meal_type || payload.mealType || null;
        const meals_objective =
          payload.meals_objective || payload.mealsObjective || null;
        const purchasing_item =
          payload.purchasing_item || payload.purchasingItem || null;
        const stationairy_item =
          payload.stationairy_item ||
          payload.stationary ||
          payload.stationary_item ||
          null;
        const service_provider =
          payload.service_provider || payload.serviceProvider || null;
        const meta = JSON.stringify(payload || {});
        return [
          reimbursementId,
          idx,
          purpose,
          date,
          from_date,
          to_date,
          travel_from,
          travel_to,
          transport_amount,
          accommodation_fees,
          da,
          total_amount,
          meal_type,
          meals_objective,
          purchasing_item,
          stationairy_item,
          service_provider,
          meta,
          now,
          now,
        ];
      });
      await conn.query(queries.SAVE_REIMBURSEMENT_LINES_BULK, [values]);
    }

    if (
      Array.isArray(reimbursementData.attachments) &&
      reimbursementData.attachments.length
    ) {
      const [insertedLines] = await conn.query(
        `SELECT id, line_index FROM reimbursement_lines WHERE reimbursement_id = ?`,
        [reimbursementId],
      );
      const lineIndexToId = {};
      insertedLines.forEach((l) => (lineIndexToId[l.line_index] = l.id));

      const attachmentsInput = reimbursementData.attachments;
      const attValues = attachmentsInput.map((a) => {
        const fileName =
          a.file_name ||
          a.filename ||
          a.originalname ||
          (a.path ? path.basename(String(a.path)) : "") ||
          "";
        // if a.line_index is provided, translate to inserted line id
        const li =
          a.line_index !== undefined && a.line_index !== null
            ? lineIndexToId[Number(a.line_index)] || null
            : null;
        return [reimbursementId, li, String(fileName || "").trim()];
      });
      if (attValues.length)
        await conn.query(queries.SAVE_ATTACHMENTS, [attValues]);
    }

    await conn.commit();
    return { id: reimbursementId, aggregated_total };
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error("createReimbursement error:", err);
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * updateReimbursement
 * Important changes:
 *  - We no longer blindly DELETE all attachments and re-insert.
 *  - We compute incoming filenames and keep existing filenames unless explicitly removed.
 *  - We only insert rows with (reimbursement_id, line_id, file_name).
 */
exports.updateReimbursement = async (reimbursementId, updateData, orgId) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();
  try {
    await conn.beginTransaction();

    // Check for duplicate invoices before updating (exclude current reimbursement)
    if (Array.isArray(updateData.invoices) && updateData.invoices.length > 0) {
      for (const invoice of updateData.invoices) {
        if (!invoice || typeof invoice !== "string") continue;
        const trimmedInvoice = invoice.trim();
        if (!trimmedInvoice) continue;

        const [existing] = await conn.query(
          queries.CHECK_INVOICE_DUPLICATE_EXCLUDE,
          [trimmedInvoice, reimbursementId],
        );
        if (existing && existing.length > 0) {
          const duplicateClaim = existing[0];
          throw new Error(
            `Duplicate invoice detected: "${trimmedInvoice}" is already used in reimbursement ID ${duplicateClaim.reimbursement_id}. Please use a unique invoice number.`,
          );
        }
      }
    }

    const [reimRows] = await conn.query(
      `SELECT employee_id FROM reimbursement WHERE id = ?`,
      [reimbursementId],
    );
    const employeeIdRef =
      reimRows && reimRows[0] ? reimRows[0].employee_id : null;

    const participantsArr = parseParticipants(updateData.participants);
    const participantsJSON = JSON.stringify(participantsArr);

    const lines = Array.isArray(updateData.lines) ? updateData.lines : [];
    const aggregated_total = lines.reduce(
      (s, l) => s + (parseFloat(l.total_amount) || 0),
      0,
    );

    await conn.query(queries.UPDATE_REIMBURSEMENT, [
      updateData.department_id || null,
      updateData.claim_type || null,
      updateData.transport_type || null,
      updateData.project || null,
      participantsJSON,
      updateData.comments || null,
      aggregated_total,
      reimbursementId,
    ]);

    // delete and re-save lines (existing approach)
    await conn.query(queries.DELETE_LINES_BY_REIMBURSEMENT_ID, [
      reimbursementId,
    ]);
    if (lines.length) {
      const now = new Date();
      const values = lines.map((l, idx) => {
        const payload =
          l.payload && typeof l.payload === "object" ? l.payload : {};

        // Include main invoices in the first line's meta
        if (
          idx === 0 &&
          Array.isArray(updateData.invoices) &&
          updateData.invoices.length > 0
        ) {
          payload.invoices = updateData.invoices;
        }

        const purpose = payload.purpose || null;
        const date = payload.date || null;
        const from_date = payload.from_date || payload.fromDate || null;
        const to_date = payload.to_date || payload.toDate || null;
        const travel_from = payload.travel_from || payload.travelFrom || null;
        const travel_to = payload.travel_to || payload.travelTo || null;
        const transport_amount = coerceNullableNumber(
          payload.transport_amount ?? payload.transportAmount ?? null,
        );
        const accommodation_fees = coerceNullableNumber(
          payload.accommodation_fees ?? payload.accommodationFees ?? null,
        );
        const da = coerceNullableNumber(payload.da ?? null);
        const total_amount = (
          parseFloat(l.total_amount || payload.total_amount || 0) || 0
        ).toFixed(2);
        const meal_type = payload.meal_type || payload.mealType || null;
        const meals_objective =
          payload.meals_objective || payload.mealsObjective || null;
        const purchasing_item =
          payload.purchasing_item || payload.purchasingItem || null;
        const stationairy_item =
          payload.stationairy_item ||
          payload.stationary ||
          payload.stationary_item ||
          null;
        const service_provider =
          payload.service_provider || payload.serviceProvider || null;
        const meta = JSON.stringify(payload || {});
        return [
          reimbursementId,
          idx,
          purpose,
          date,
          from_date,
          to_date,
          travel_from,
          travel_to,
          transport_amount,
          accommodation_fees,
          da,
          total_amount,
          meal_type,
          meals_objective,
          purchasing_item,
          stationairy_item,
          service_provider,
          meta,
          now,
          now,
        ];
      });
      await conn.query(queries.SAVE_REIMBURSEMENT_LINES_BULK, [values]);
    }

    // === Attachments handling (preserve existing unless removed) ===
    // Fetch current attachments for reimbursement
    const [existingAttachRows] = await conn.query(
      `SELECT id, file_name FROM reimbursement_attachments WHERE reimbursement_id = ?`,
      [reimbursementId],
    );
    const existingFileNameSet = new Set(
      (existingAttachRows || []).map((r) => String(r.file_name).trim()),
    );

    // Build map of filename -> info for incoming attachments (updateData.attachments)
    const incomingAttachments = Array.isArray(updateData.attachments)
      ? updateData.attachments.slice()
      : [];

    // Normalize incoming filenames (some entries may contain path or file_path); extract base name
    const incomingFileNames = incomingAttachments
      .map((a) => {
        const fn =
          a &&
          (a.file_name ||
            a.filename ||
            a.originalname ||
            (a.path ? path.basename(String(a.path)) : null) ||
            "");
        return fn ? String(fn).trim() : null;
      })
      .filter(Boolean);

    // Determine which existing files were removed (existing minus incoming) -> delete those
    // If incomingFileNames empty that means user removed all attachments => delete all
    if (!incomingFileNames.length) {
      // user removed all attachments -> delete all rows for this reimbursement
      await conn.query(queries.DELETE_ATTACHMENTS_BY_REIMBURSEMENT_ID, [
        reimbursementId,
      ]);
    } else {
      // delete any existing attachment whose file_name is NOT present in incomingFileNames
      await conn.query(
        `DELETE FROM reimbursement_attachments WHERE reimbursement_id = ? AND file_name NOT IN (?)`,
        [reimbursementId, incomingFileNames],
      );
    }

    // Build map from line_index -> inserted DB line id (we already re-inserted lines above)
    const [insertedLines] = await conn.query(
      `SELECT id, line_index FROM reimbursement_lines WHERE reimbursement_id = ?`,
      [reimbursementId],
    );
    const lineIndexToId = {};
    insertedLines.forEach((l) => (lineIndexToId[l.line_index] = l.id));

    // Now compute which of incoming filenames are new and need insertion
    const toInsert = [];
    for (const a of incomingAttachments) {
      const rawFileName =
        a &&
        (a.file_name ||
          a.filename ||
          a.originalname ||
          (a.path ? path.basename(String(a.path)) : null) ||
          "");
      const fileName = rawFileName ? String(rawFileName).trim() : null;
      if (!fileName) continue;

      if (existingFileNameSet.has(fileName)) {
        // already present (we kept it), skip insert
        continue;
      }

      // Determine DB line id if a.line_index provided
      let lineId = null;
      if (typeof a.line_id !== "undefined" && a.line_id !== null) {
        // If frontend provided actual DB line id (rare), use it; otherwise treat as line_index and map
        // We expect frontend normally sends line_index -> so try to map
        if (
          Number.isFinite(Number(a.line_id)) &&
          lineIndexToId[Number(a.line_id)]
        ) {
          lineId = lineIndexToId[Number(a.line_id)];
        } else if (
          Number.isFinite(Number(a.line_index)) &&
          lineIndexToId[Number(a.line_index)]
        ) {
          lineId = lineIndexToId[Number(a.line_index)];
        } else if (
          Number.isFinite(Number(a.line_index)) === false &&
          Number.isFinite(Number(a.line_id)) === true
        ) {
          // fallback: treat a.line_id as the DB line id if it looks like it already is DB id
          lineId = a.line_id;
        } else {
          // fallback null
          lineId = null;
        }
      } else if (typeof a.line_index !== "undefined" && a.line_index !== null) {
        if (
          Number.isFinite(Number(a.line_index)) &&
          lineIndexToId[Number(a.line_index)]
        ) {
          lineId = lineIndexToId[Number(a.line_index)];
        }
      }

      toInsert.push([
        reimbursementId,
        lineId !== undefined ? lineId : null,
        fileName,
      ]);
    }

    if (toInsert.length) {
      await conn.query(queries.SAVE_ATTACHMENTS, [toInsert]);
    }

    await conn.commit();
    return { id: reimbursementId, aggregated_total };
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error("updateReimbursement error:", err);
    throw err;
  } finally {
    conn.release();
  }
};

exports.getTeamReimbursements = async (
  departmentId,
  submittedFrom,
  submittedTo,
  teamLeadId,
  orgId,
) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  try {
    const dept =
      departmentId !== undefined && departmentId !== null ? departmentId : null;
    const excludedId =
      teamLeadId !== undefined && teamLeadId !== null ? teamLeadId : null;
    const from =
      submittedFrom && submittedFrom !== "null" ? submittedFrom : null;
    const params = [dept, excludedId, excludedId, from, from, from];

    const [reimbursementsRaw] = await tenantPool.query(
      queries.GET_TEAM_REIMBURSEMENTS,
      params,
    );

    if (!reimbursementsRaw || reimbursementsRaw.length === 0) return [];

    const normalized = reimbursementsRaw.map((r) => {
      const n = normalizeRow(r);
      const participants = parseParticipantsSafe(r.participants);
      const invoices = parseInvoices(r.invoices);
      return {
        ...n,
        participants,
        invoices,
        from_date: toLocalDateString(r.from_date),
        to_date: toLocalDateString(r.to_date),
        date: toLocalDateString(r.date),
      };
    });

    const reimbursementEmployeeMap = {};
    normalized.forEach((r) => {
      reimbursementEmployeeMap[r.id] = r.employee_id;
    });

    const reimbursementIds = normalized.map((r) => r.id);
    const safeIds = reimbursementIds.length ? reimbursementIds : [-1];

    const [linesRows] = await tenantPool.query(
      queries.GET_LINES_BY_REIMBURSEMENT_IDS,
      [safeIds],
    );
    const [attachmentsRows] = await tenantPool.query(
      queries.GET_ATTACHMENTS_BY_REIMBURSEMENT_IDS,
      [safeIds],
    );

    const linesByReim = {};
    (linesRows || []).forEach((l) => {
      let parsedMeta = {};
      try {
        parsedMeta = l.meta
          ? typeof l.meta === "string"
            ? JSON.parse(l.meta)
            : l.meta
          : {};
      } catch (e) {
        parsedMeta = {};
        console.warn("Failed to parse line.meta:", e?.message || e, l.meta);
      }

      const payload = {
        ...parsedMeta,
        purpose: parsedMeta.purpose || l.purpose || null,
        date: parsedMeta.date || (l.date ? toLocalDateString(l.date) : null),
        from_date:
          parsedMeta.from_date ||
          (l.from_date ? toLocalDateString(l.from_date) : null),
        to_date:
          parsedMeta.to_date ||
          (l.to_date ? toLocalDateString(l.to_date) : null),
        travel_from: parsedMeta.travel_from || l.travel_from || null,
        travel_to: parsedMeta.travel_to || l.travel_to || null,

        transport_amount:
          parsedMeta.transport_amount ??
          (l.transport_amount !== null ? parseFloat(l.transport_amount) : null),
        accommodation_fees:
          parsedMeta.accommodation_fees ??
          (l.accommodation_fees !== null
            ? parseFloat(l.accommodation_fees)
            : null),
        da: parsedMeta.da ?? (l.da !== null ? parseFloat(l.da) : null),
        total_amount:
          parsedMeta.total_amount ??
          (l.total_amount !== null ? parseFloat(l.total_amount) : null),

        meal_type: parsedMeta.meal_type || l.meal_type || null,
        meals_objective:
          parsedMeta.meals_objective || l.meals_objective || null,
        purchasing_item:
          parsedMeta.purchasing_item || l.purchasing_item || null,
        stationairy_item:
          parsedMeta.stationairy_item || l.stationairy_item || null,
        service_provider:
          parsedMeta.service_provider || l.service_provider || null,

        invoices: parseInvoices(parsedMeta.invoices),
        attachments: Array.isArray(parsedMeta.attachments)
          ? parsedMeta.attachments
          : parsedMeta.attachments
            ? [parsedMeta.attachments]
            : [],
      };

      if (!linesByReim[l.reimbursement_id])
        linesByReim[l.reimbursement_id] = [];
      linesByReim[l.reimbursement_id].push({
        id: l.id,
        line_index: l.line_index,
        line_type: l.line_type || null,
        payload,
        total_amount: parseFloat(l.total_amount || 0).toFixed(2),
      });
    });

    const attachmentMap = {};
    (attachmentsRows || []).forEach((att) => {
      const rid = att.reimbursement_id;
      if (!attachmentMap[rid]) attachmentMap[rid] = [];
      const empHint = reimbursementEmployeeMap
        ? reimbursementEmployeeMap[rid]
        : null;
      attachmentMap[rid].push({
        id: att.id,
        line_id: att.line_id,
        file_name: att.file_name,
        // no file_path persisted or returned
        url: buildAttachmentUrl(att.file_name, empHint),
      });
    });

    const enriched = normalized.map((r) => {
      const lines = (linesByReim[r.id] || []).sort(
        (a, b) => (a.line_index || 0) - (b.line_index || 0),
      );
      const attList = attachmentMap[r.id] || [];

      const claimLevelAttachments = attList
        .filter((a) => !a.line_id)
        .map((a) => ({
          id: a.id,
          file_name: a.file_name,
          file_path: undefined,
          url: a.url || buildAttachmentUrl(a.file_name, r.employee_id),
        }));

      const line_attachments_map = attList
        .filter((a) => a.line_id)
        .reduce((acc, a) => {
          if (!acc[a.line_id]) acc[a.line_id] = [];
          acc[a.line_id].push({
            id: a.id,
            line_id: a.line_id,
            file_name: a.file_name,
            file_path: undefined,
            url: a.url || buildAttachmentUrl(a.file_name, r.employee_id),
          });
          return acc;
        }, {});

      const invoiceSet = new Set();
      (Array.isArray(r.invoices)
        ? r.invoices
        : parseInvoices(r.invoices)
      ).forEach((inv) => inv && invoiceSet.add(String(inv).trim()));
      (lines || []).forEach((ln) => {
        const linv = ln?.payload?.invoices || [];
        (Array.isArray(linv) ? linv : parseInvoices(linv)).forEach((inv) => {
          if (inv) invoiceSet.add(String(inv).trim());
        });
      });
      const aggregatedInvoices = Array.from(invoiceSet);

      return {
        ...r,
        lines,
        attachments: claimLevelAttachments,
        line_attachments_map,
        invoices: aggregatedInvoices,
      };
    });

    return enriched;
  } catch (err) {
    console.error("Error in getTeamReimbursements:", err);
    throw err;
  }
};

exports.updateReimbursementStatus = async (
  id,
  status,
  approver_comments,
  approver_id,
  approver_name,
  approver_designation,
  project,
  orgId,
) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  try {
    if (!id) throw new Error("id is required");
    const allowed = ["approved", "rejected"];
    if (!allowed.includes(String(status).toLowerCase())) {
      const e = new Error(
        "Invalid status. Allowed values: 'approved', 'rejected'",
      );
      e.statusCode = 400;
      throw e;
    }

    const params = [
      status,
      approver_comments || null,
      approver_id || null,
      approver_name || null,
      approver_designation || null,
      project || null,
      new Date(),
      id,
    ];

    const [result] = await tenantPool.query(
      queries.UPDATE_REIMBURSEMENT_STATUS,
      params,
    );

    if (!result || result.affectedRows === 0) {
      const e = new Error("No reimbursement updated");
      e.statusCode = 404;
      throw e;
    }

    return {
      id,
      status,
      approver_comments,
      approver_id,
      approver_name,
      approver_designation,
      project,
      approved_date: new Date(),
    };
  } catch (err) {
    console.error("Error in updateReimbursementStatus:", err);
    throw err;
  }
};

exports.updatePaymentStatus = async (
  id,
  payment_status,
  paid_date = null,
  orgId,
) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  try {
    if (!id) throw new Error("id is required");
    const params = [payment_status || null, paid_date || null, id];
    const [result] = await tenantPool.query(
      queries.UPDATE_PAYMENT_STATUS,
      params,
    );

    if (!result || result.affectedRows === 0) {
      const e = new Error("No reimbursement updated for payment status");
      e.statusCode = 404;
      throw e;
    }

    return { id, payment_status, paid_date };
  } catch (err) {
    console.error("Error in updatePaymentStatus:", err);
    throw err;
  }
};

exports.getAttachments = async (reimbursementId, orgId) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  try {
    if (!reimbursementId) return [];
    const [rows] = await tenantPool.query(queries.GET_ATTACHMENTS, [
      reimbursementId,
    ]);
    // return rows with id, reimbursement_id, line_id, file_name
    return rows || [];
  } catch (err) {
    console.error("Error in getAttachments:", err);
    throw err;
  }
};

exports.getAttachmentsByReimbursementIds = async (
  reimbursementIds = [],
  orgId,
) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  try {
    if (!reimbursementIds || !reimbursementIds.length) return [];
    const [attachments] = await tenantPool.query(
      queries.GET_ATTACHMENTS_BY_REIMBURSEMENT_IDS,
      [reimbursementIds],
    );
    return attachments || [];
  } catch (err) {
    console.error("Error in getAttachmentsByReimbursementIds:", err);
    throw err;
  }
};

exports.getAttachmentMeta = async (req, res) => {
  // leave this for handlers (the handler code will use service.getAttachmentsByReimbursementIds)
  throw new Error("Not implemented in service; use handler route.");
};

exports.deleteReimbursement = async (id, orgId) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  try {
    if (!id) throw new Error("id is required");
    await tenantPool.query(queries.DELETE_REIMBURSEMENT, [id]);
    return { id };
  } catch (err) {
    console.error("Error in deleteReimbursement:", err);
    throw err;
  }
};

exports.getApproverDetails = async (approver_id, orgId) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  try {
    const [rows] = await tenantPool.query(queries.GET_APPROVER_DETAILS, [
      approver_id,
    ]);
    return rows && rows.length ? rows[0] : null;
  } catch (err) {
    console.error("Error in getApproverDetails:", err);
    throw err;
  }
};

exports.getAllProjects = async (orgId) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  try {
    const [projects] = await tenantPool.query(queries.GET_ALL_PROJECTS);
    if (!projects || projects.length === 0) return [];
    return projects.map((p) => p.project_name);
  } catch (err) {
    console.error("Error in getAllProjects:", err);
    throw err;
  }
};

module.exports = exports;
