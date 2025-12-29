const fs = require("fs");
const os = require("os");
const path = require("path");

function coerceToString(val, fallback = null) {
  if (val === undefined || val === null) return fallback;
  if (Array.isArray(val)) val = val[val.length - 1];
  try {
    const s = String(val);
    return s.length ? s : fallback;
  } catch (e) {
    return fallback;
  }
}

function parseDates(q = {}) {
  const rawFormat = coerceToString(q.format, "xlsx");
  const format = (rawFormat || "xlsx").toLowerCase();

  const rawStatus = coerceToString(q.status, null);
  const statusCandidate =
    rawStatus && String(rawStatus).trim().toLowerCase() === "all"
      ? null
      : rawStatus;

  const startDate = coerceToString(q.startDate, null);
  const endDate = coerceToString(q.endDate, null);

  const rawFields = coerceToString(q.fields, null);
  const fields = rawFields
    ? String(rawFields)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

  return {
    startDate: startDate || null,
    endDate: endDate || null,
    status: statusCandidate || null,
    format,
    fields,
  };
}

const MAX_RANGE_DAYS = 62;

function parseDateISO(d) {
  if (!d) return null;
  if (typeof d !== "string") return null;
  const parts = d.split("-");
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(day))
    return null;
  return new Date(Date.UTC(y, m, day));
}

function daysBetweenInclusive(startIso, endIso) {
  const s = parseDateISO(startIso);
  const e = parseDateISO(endIso);
  if (!s || !e) return Infinity;
  const diffMs = e.getTime() - s.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

function ensureTwoMonthWindow(startDate, endDate) {
  const now = new Date();

  if (!startDate && !endDate) {
    const end = now;
    const start = new Date(now);
    start.setMonth(start.getMonth() - 2);
    const fmt = (d) => d.toISOString().slice(0, 10);
    return { ok: true, startDate: fmt(start), endDate: fmt(end) };
  }

  if (!startDate || !endDate) {
    return {
      ok: false,
      message:
        "Please provide both startDate and endDate, or leave both empty to use the default last 2 months range.",
    };
  }

  const s = parseDateISO(startDate);
  const e = parseDateISO(endDate);
  if (!s || !e) {
    return { ok: false, message: "Invalid date format. Use YYYY-MM-DD." };
  }
  if (s > e) {
    return { ok: false, message: "Start date cannot be after End date." };
  }

  const numDays = daysBetweenInclusive(startDate, endDate);
  if (numDays > MAX_RANGE_DAYS) {
    return {
      ok: false,
      message: `Requested range is too large: ${numDays} days. Maximum allowed range is ${MAX_RANGE_DAYS} days (≈ 2 months).`,
    };
  }

  return { ok: true, startDate, endDate };
}

function isPreviewRequest(req) {
  const q = req && req.query && req.query.preview;
  const accept = req && req.headers && req.headers.accept;
  return (
    String(q).toLowerCase() === "true" ||
    (accept && accept.includes("application/json"))
  );
}

function sendPreviewResponse(req, res, rows) {
  const limitRaw = req.query && req.query.previewLimit;
  let previewLimit = null;
  if (limitRaw != null) {
    const n = parseInt(limitRaw, 10);
    previewLimit = Number.isFinite(n) && n > 0 ? n : null;
  }
  const totalRows = Array.isArray(rows) ? rows.length : 0;
  const outRows = Array.isArray(rows)
    ? previewLimit && previewLimit > 0
      ? rows.slice(0, previewLimit)
      : rows
    : [];

  res.setHeader("Content-Type", "application/json");
  return res.status(200).json({ rows: outRows, totalRows });
}

function safeFilename(base, ext) {
  const now = new Date().toISOString().replace(/[:.]/g, "-");
  return `${base}_${now}.${ext}`;
}

function pickFields(rows, fields) {
  if (!Array.isArray(rows)) return [];
  if (!fields || fields.length === 0) return rows.map((r) => ({ ...r }));
  const finalFields = fields
    .map((f) => (f == null ? "" : String(f).trim()))
    .filter(Boolean);
  return rows.map((r) => {
    const o = {};
    for (const f of finalFields) {
      if (Object.prototype.hasOwnProperty.call(r, f)) o[f] = r[f];
      else {
        const key = Object.keys(r).find(
          (k) => String(k).toLowerCase() === String(f).toLowerCase()
        );
        o[f] = key ? r[key] : "";
      }
    }
    return o;
  });
}

module.exports = {
  coerceToString,
  parseDates,
  ensureTwoMonthWindow,
  isPreviewRequest,
  sendPreviewResponse,
  safeFilename,
  pickFields,
};
