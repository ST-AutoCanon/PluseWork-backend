const fs = require("fs");
const path = require("path");
const util = require("util");

const reportUtils = require("./reportUtils");
const queries = require("../constants/reportQueries");

function coerceToString(val, fallback = null) {
  if (val === undefined || val === null) return fallback;
  if (Array.isArray(val)) val = val[val.length - 1];
  try {
    const s = String(val).trim();
    return s.length ? s : fallback;
  } catch (e) {
    return fallback;
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const STATUS_SYNONYMS = {
  assigned: [
    "assigned",
    "assignedto",
    "assigned_to",
    "in use",
    "inuse",
    "in-use",
    "allocated",
    "issued",
    "issuedto",
    "using",
  ],
  unassigned: [
    "unassigned",
    "not using",
    "notusing",
    "notinuse",
    "available",
    "free",
    "notassigned",
    "not-assigned",
    "not-using",
    "not_using",
  ],
  returned: ["returned", "returnedto", "returned_to"],
  decommissioned: [
    "decommissioned",
    "decomm",
    "retired",
    "disposed",
    "de-commissioned",
  ],
  pending: ["pending"],
  approved: ["approved"],
  rejected: ["rejected"],
  "approved/paid": ["approved/paid", "approvedpaid", "approved_paid"],
  "approved/pending": [
    "approved/pending",
    "approvedpending",
    "approved_pending",
  ],
};

function normalizeStringForSynonym(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[\u2018\u2019\u201C\u201D]/g, "")
    .replace(/[_\s\-–—]+/g, " ")
    .replace(/[^\w\s\/]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizeStatusToken(raw) {
  if (raw === undefined || raw === null) return null;
  let s = typeof raw === "string" ? raw.trim() : String(raw).trim();
  if (!s) return null;

  const lowCheck = s.toLowerCase();
  if (["all", "null", "undefined", "none", "any"].includes(lowCheck))
    return null;

  let normalized = normalizeStringForSynonym(s);

  if (
    normalized === "in use" ||
    normalized === "inuse" ||
    normalized.indexOf("in use") !== -1 ||
    normalized.indexOf("inuse") !== -1
  ) {
    return "assigned";
  }

  if (
    normalized === "assignedto" ||
    normalized === "assigned_to" ||
    normalized === "assigned"
  ) {
    return "assigned";
  }

  if (
    normalized.startsWith("not ") ||
    normalized.startsWith("not-") ||
    normalized.startsWith("no ")
  ) {
    if (normalized.includes("use") || normalized.includes("using")) {
      return "unassigned";
    }
  }

  const directMap = {
    approve: "approved",
    approved: "approved",
    rejecting: "rejected",
    reject: "rejected",
    rejected: "rejected",
    pending: "pending",
    paid: "paid",
    unpaid: "unpaid",
    "approved/paid": "approved/paid",
    "approved/pending": "approved/pending",
    "approved/unpaid": "approved/unpaid",
    "punch in": "punch in",
    "punch out": "punch out",
    "yet to start": "yet to start",
    "not started": "not started",
    "not-started": "not started",
    notstarted: "not started",
    "in progress": "in progress",
    inprogress: "in progress",
    "in-progress": "in progress",
    "on hold": "on hold",
    "on-hold": "on hold",
    onhold: "on hold",
    incomplete: "incomplete",
    working: "working",
    "working on": "working",
    "in review": "in review",
    "in-review": "in review",
    active: "active",
    inactive: "inactive",
    returned: "returned",
    decommissioned: "decommissioned",
  };

  if (Object.prototype.hasOwnProperty.call(directMap, normalized)) {
    return directMap[normalized];
  }

  for (const canon of Object.keys(STATUS_SYNONYMS)) {
    const syns = STATUS_SYNONYMS[canon] || [];
    for (const synRaw of syns) {
      const synNorm = normalizeStringForSynonym(synRaw);
      if (!synNorm) continue;
      if (normalized === synNorm) return canon;
      if (normalized.includes(synNorm)) return canon;
      if (synNorm.includes(normalized)) return canon;
    }
  }

  if (normalized.includes("/")) {
    const parts = normalized
      .split("/")
      .map((p) => p.trim())
      .filter(Boolean);
    const canonParts = parts
      .map((p) => canonicalizeStatusToken(p))
      .filter(Boolean);
    if (canonParts.length === parts.length) {
      return canonParts.join("/");
    }
  }

  return normalized;
}

function normalizeStatusForQuery(status) {
  return canonicalizeStatusToken(status);
}

function buildDateStatusParams(startDate, endDate, status) {
  const s = startDate || null;
  const e = endDate || null;
  const st = normalizeStatusForQuery(status);
  if (!st) {
    return [s, s, e, e, null, null];
  }
  return [s, s, e, e, st, st];
}

function keepOnlyFields(rows, requestedFields, defaultOrder) {
  if (!Array.isArray(rows)) return [];
  if (!requestedFields || requestedFields.length === 0) {
    return rows.map((r) => ({ ...r }));
  }
  const fieldsToReturn = [];
  const seen = new Set();
  for (const f of requestedFields) {
    const k = String(f || "").trim();
    if (!k) continue;
    if (!seen.has(k)) {
      fieldsToReturn.push(k);
      seen.add(k);
    }
  }
  const finalFields =
    fieldsToReturn.length > 0
      ? fieldsToReturn
      : defaultOrder || Object.keys(rows[0] || {});
  return rows.map((r) => {
    const obj = {};
    for (const f of finalFields) {
      if (Object.prototype.hasOwnProperty.call(r, f)) {
        obj[f] = r[f];
      } else {
        const lower = f.toLowerCase();
        const foundKey = Object.keys(r).find(
          (k) => String(k).toLowerCase() === lower
        );
        if (foundKey) obj[f] = r[foundKey];
        else obj[f] = "";
      }
    }
    return obj;
  });
}

function pickFields(rows, fields) {
  return keepOnlyFields(rows, fields, null);
}

function normalizeReimbursementRow(raw) {
  const r = Object.assign({}, raw);
  if (!Object.prototype.hasOwnProperty.call(r, "approval_status")) {
    r.approval_status =
      r.status !== undefined &&
      r.status !== null &&
      String(r.status).trim() !== ""
        ? r.status
        : "";
  }
  if (
    !Object.prototype.hasOwnProperty.call(r, "payment_status") ||
    r.payment_status === null
  ) {
    if (
      Object.prototype.hasOwnProperty.call(r, "raw_payment_status") &&
      r.raw_payment_status != null &&
      String(r.raw_payment_status).trim() !== ""
    ) {
      r.payment_status = r.raw_payment_status;
    } else {
      r.payment_status = r.approval_status || "";
    }
  }
  if (
    !Object.prototype.hasOwnProperty.call(r, "id") &&
    Object.prototype.hasOwnProperty.call(r, "reimbursement_id")
  ) {
    r.id = r.reimbursement_id;
  }
  if (
    !Object.prototype.hasOwnProperty.call(r, "employee_name") &&
    (r.first_name || r.last_name)
  ) {
    r.employee_name = `${r.first_name || ""} ${r.last_name || ""}`.trim();
  }
  return r;
}

async function applyEmployeeAndDepartmentFilters(
  rows,
  employeeId,
  departmentId
) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  let filtered = rows;

  if (employeeId != null && String(employeeId).trim() !== "") {
    const empStr = String(employeeId).trim();
    filtered = filtered.filter((r) => {
      if (r.employee_id != null) return String(r.employee_id).trim() === empStr;
      const keys = Object.keys(r);
      const foundKey = keys.find(
        (k) => String(k).toLowerCase() === "employee_id"
      );
      if (foundKey) return String(r[foundKey]).trim() === empStr;
      return Object.values(r).some((v) => String(v || "").trim() === empStr);
    });
  }

  if (!Array.isArray(filtered) || filtered.length === 0) return [];

  if (departmentId != null && String(departmentId).trim() !== "") {
    const didStr = String(departmentId).trim();

    const hasDeptIdField = filtered.some((r) =>
      Object.prototype.hasOwnProperty.call(r, "department_id")
    );
    if (hasDeptIdField) {
      filtered = filtered.filter((r) => {
        const val = r.department_id;
        if (val === null || val === undefined) return false;
        return String(val).trim() === didStr;
      });
      return filtered;
    }

    const empIds = Array.from(
      new Set(
        filtered
          .map((r) =>
            r.employee_id != null ? String(r.employee_id).trim() : null
          )
          .filter(Boolean)
      )
    );

    if (empIds.length > 0) {
      try {
        const placeholders = empIds.map(() => "?").join(",");
        const sql = `SELECT employee_id, department_id FROM employee_professional WHERE employee_id IN (${placeholders})`;
        const deptRows = await reportUtils.fetchRows(sql, empIds);
        const empToDept = {};
        if (Array.isArray(deptRows)) {
          for (const dr of deptRows) {
            if (dr && dr.employee_id != null) {
              empToDept[String(dr.employee_id).trim()] =
                dr.department_id != null
                  ? String(dr.department_id).trim()
                  : null;
            }
          }
        }

        const hasAnyMapping = Object.keys(empToDept).length > 0;
        if (hasAnyMapping) {
          filtered = filtered.filter((r) => {
            const emp =
              r.employee_id != null ? String(r.employee_id).trim() : null;
            if (!emp) return false;
            const did = empToDept[emp];
            return did != null && String(did).trim() === didStr;
          });
          return filtered;
        }
      } catch (e) {
        console.warn(
          "[reportFilters] employee_professional lookup failed, falling back to department_name resolution:",
          e && (e.message || e)
        );
      }
    }

    try {
      let deptName = null;
      if (queries && queries.GET_DEPARTMENT_NAME_BY_ID) {
        try {
          const nameRows = await reportUtils.fetchRows(
            queries.GET_DEPARTMENT_NAME_BY_ID,
            [departmentId]
          );
          if (Array.isArray(nameRows) && nameRows[0]) {
            deptName = (
              nameRows[0].name ||
              nameRows[0].department_name ||
              nameRows[0].department ||
              ""
            )
              .toString()
              .trim()
              .toLowerCase();
          }
        } catch (e) {}
      }
      if (!deptName) {
        try {
          const rowsDept = await reportUtils.fetchRows(
            "SELECT name FROM departments WHERE id = ? LIMIT 1",
            [departmentId]
          );
          if (Array.isArray(rowsDept) && rowsDept[0] && rowsDept[0].name) {
            deptName = String(rowsDept[0].name).trim().toLowerCase();
          }
        } catch (e) {}
      }

      if (deptName !== null && deptName !== "") {
        filtered = filtered.filter((r) => {
          const dn = r.department_name;
          if (dn === null || dn === undefined) return false;
          return String(dn).trim().toLowerCase() === deptName;
        });
        return filtered;
      }
    } catch (e) {}

    filtered = filtered.filter((r) => {
      const dn = r.department_name;
      if (!dn) return false;
      return String(dn).toLowerCase().includes(didStr.toLowerCase());
    });
  }

  return filtered;
}

function normalizeForCompare(s) {
  if (s === undefined || s === null) return "";
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^\w\/]+/g, "")
    .replace(/_+/g, "")
    .replace(/-+/g, "");
}

function parseAssignedToValue(v) {
  try {
    if (!v && v !== 0) return [];
    if (Array.isArray(v)) return v;
    const sRaw = String(v);
    const s = sRaw.trim();
    if (!s) return [];

    if (s.startsWith("[") || s.startsWith("{")) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === "object") return [parsed];
      } catch (e) {}
    }

    try {
      const unq = s.replace(/\\+/g, "\\");
      const parsed2 = JSON.parse(unq);
      if (Array.isArray(parsed2)) return parsed2;
      if (parsed2 && typeof parsed2 === "object") return [parsed2];
    } catch (e) {}

    try {
      const dq = s.replace(/'/g, '"');
      const parsed3 = JSON.parse(dq);
      if (Array.isArray(parsed3)) return parsed3;
      if (parsed3 && typeof parsed3 === "object") return [parsed3];
    } catch (e) {}

    try {
      const arr = [];
      const objRegex = /(\{[^}]*\})/g;
      let m;
      while ((m = objRegex.exec(s)) !== null) {
        try {
          const candidate = m[1].replace(/'/g, '"').replace(/\\+/g, "\\");
          const parsed = JSON.parse(candidate);
          if (parsed && typeof parsed === "object") arr.push(parsed);
        } catch (e) {}
      }
      if (arr.length > 0) return arr;
    } catch (e) {}

    try {
      const statuses = [];
      const statusRegex = /"status"\s*:\s*"([^"]+)"/gi;
      let m2;
      while ((m2 = statusRegex.exec(s)) !== null) {
        statuses.push({ status: String(m2[1]) });
      }
      if (statuses.length > 0) return statuses;
    } catch (e) {}

    return [];
  } catch (e) {
    return [];
  }
}

function hasActiveAssignment(assignedArray) {
  if (!Array.isArray(assignedArray) || assignedArray.length === 0) return false;

  const now = Date.now();

  for (const entry of assignedArray) {
    try {
      if (!entry || typeof entry !== "object") continue;

      const statusRaw =
        entry.status || entry.Status || entry.assignmentStatus || "";
      const returnDate =
        entry.returnDate ||
        entry.return_date ||
        entry.returnedAt ||
        entry.return ||
        null;
      const startDate = entry.startDate || entry.start_date || null;
      const empId =
        entry.employeeId || entry.employee_id || entry.employee || null;

      const canonStatus = canonicalizeStatusToken(statusRaw) || "";

      if (
        canonStatus === "returned" ||
        canonStatus === "decommissioned" ||
        canonStatus === "unassigned"
      ) {
        continue;
      }

      if (returnDate && String(returnDate).trim() !== "") {
        const d = new Date(returnDate);
        if (!isNaN(d.getTime()) && d.getTime() <= now) {
          continue;
        }
      }

      if (startDate && (!returnDate || String(returnDate).trim() === "")) {
        return true;
      }

      if (
        ["assigned", "in use", "allocated", "issued", "using"].includes(
          canonStatus
        )
      ) {
        return true;
      }

      if (
        empId &&
        String(empId).trim() !== "" &&
        (!returnDate || String(returnDate).trim() === "")
      ) {
        return true;
      }
    } catch (e) {
      continue;
    }
  }

  return false;
}

function statusMatches(requestedStatus, rowStatusCandidates = []) {
  try {
    if (!requestedStatus) return true;
    const reqRaw = String(requestedStatus || "").trim();
    if (!reqRaw) return true;

    const reqCanon = canonicalizeStatusToken(reqRaw);
    const candArr = Array.isArray(rowStatusCandidates)
      ? rowStatusCandidates
      : typeof rowStatusCandidates === "string"
      ? [rowStatusCandidates]
      : [];

    const lifecycleTokens = [
      "assigned",
      "unassigned",
      "returned",
      "decommissioned",
    ];
    if (lifecycleTokens.includes(reqCanon)) {
      for (const rawCand of candArr) {
        try {
          const assignedArr = parseAssignedToValue(rawCand);
          if (Array.isArray(assignedArr) && assignedArr.length > 0) {
            for (const entry of assignedArr) {
              const entStatus =
                (entry &&
                  (entry.status || entry.Status || entry.assignmentStatus)) ||
                "";
              const entCanon = canonicalizeStatusToken(entStatus) || "";
              if (!entCanon) continue;
              if (reqCanon === "assigned") {
                const returnDate =
                  (entry &&
                    (entry.returnDate || entry.return_date || entry.return)) ||
                  null;
                const startDate =
                  (entry && (entry.startDate || entry.start_date)) || null;
                const isReturnedOrDecomm = [
                  "returned",
                  "decommissioned",
                ].includes(entCanon);
                if (
                  !isReturnedOrDecomm &&
                  (!returnDate || String(returnDate).trim() === "")
                ) {
                  return true;
                }
                if (
                  entCanon === "assigned" ||
                  entCanon === "in use" ||
                  entCanon === "allocated"
                )
                  return true;
              }
              if (reqCanon === "unassigned") {
                if (
                  entCanon === "returned" ||
                  entCanon === "decommissioned" ||
                  entCanon === "unassigned" ||
                  !entCanon
                ) {
                }
              }
              if (reqCanon === "returned" && entCanon === "returned")
                return true;
              if (
                reqCanon === "decommissioned" &&
                entCanon === "decommissioned"
              )
                return true;
            }
            if (reqCanon === "unassigned") {
              const anyActive = hasActiveAssignment(assignedArr);
              if (!anyActive) return true;
            }
            continue;
          }

          if (typeof rawCand === "string") {
            const match = rawCand.match(/"status"\s*:\s*"([^"]+)"/i);
            if (match && match[1]) {
              const candCanon = canonicalizeStatusToken(match[1]);
              if (candCanon === reqCanon) return true;
              if (
                reqCanon === "assigned" &&
                (candCanon === "assigned" || candCanon === "in use")
              )
                return true;
            }
          }
        } catch (e) {
          continue;
        }
      }
    }

    const candidateCanons = candArr
      .map((v) => (v === null || v === undefined ? "" : String(v)))
      .filter(Boolean)
      .map((v) => canonicalizeStatusToken(v));

    if (reqCanon) {
      for (const cc of candidateCanons) {
        if (!cc) continue;
        if (cc === reqCanon) return true;
        if (cc.includes(reqCanon) || reqCanon.includes(cc)) return true;
        if (reqCanon.includes("/")) {
          const parts = reqCanon
            .split("/")
            .map((p) => p.trim())
            .filter(Boolean);
          if (parts.length > 0 && parts.every((p) => cc.includes(p)))
            return true;
        }
      }
    }

    const reqNorm = normalizeForCompare(reqRaw);
    const normalizedRowVals = candArr
      .map((v) => (v === null || v === undefined ? "" : String(v)))
      .filter(Boolean)
      .map(normalizeForCompare);

    if (normalizedRowVals.length === 0) return false;

    if (reqNorm.includes("/")) {
      const parts = reqNorm
        .split("/")
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length === 0) return false;
      const ok = parts.every((part) =>
        normalizedRowVals.some((rv) => rv === part || rv.includes(part))
      );
      if (ok) return true;
    }

    if (
      normalizedRowVals.some((rv) => rv === reqNorm || rv.includes(reqNorm))
    ) {
      return true;
    }

    if (process && process.env && process.env.NODE_ENV !== "production") {
      try {
        const candidDisplay = JSON.stringify({
          requested: { raw: reqRaw, canon: reqCanon, norm: reqNorm },
          candidates: candArr,
          normalizedRowVals,
        });
        console.debug(
          `[reportFilters] statusMatches NO MATCH => ${candidDisplay}`
        );
      } catch (e) {}
    }

    return false;
  } catch (e) {
    console.error("statusMatches error:", e && (e.message || e));
    return true;
  }
}

function isPreviewRequest(req) {
  if (!req) return false;
  const q = req.query && req.query.preview;

  if (q === true) return true;
  if (typeof q === "string") {
    const v = q.toLowerCase().trim();
    if (v === "true" || v === "1") return true;
    return false;
  }

  if (typeof q === "number") return q === 1;

  return false;
}

async function sendPreviewResponse(req, res, rows, message) {
  const limitRaw = req.query && req.query.previewLimit;
  let previewLimit = null;
  if (limitRaw != null) {
    const n = parseInt(limitRaw, 10);
    previewLimit = Number.isFinite(n) && n > 0 ? n : null;
  }
  const safeRows = Array.isArray(rows) ? rows : [];
  const totalRows = safeRows.length;
  const outRows =
    previewLimit && previewLimit > 0
      ? safeRows.slice(0, previewLimit)
      : safeRows;

  const meta = {};

  try {
    const rawStatus = coerceToString(req.query && req.query.status, null);
    meta.status = rawStatus ? normalizeStatusForQuery(rawStatus) : null;
  } catch (e) {
    meta.status = null;
  }

  try {
    const depId = coerceToString(
      req.query && (req.query.department_id || req.query.departmentId),
      null
    );
    if (depId) {
      if (queries && queries.GET_DEPARTMENT_NAME_BY_ID) {
        try {
          const nameRows = await reportUtils.fetchRows(
            queries.GET_DEPARTMENT_NAME_BY_ID,
            [depId]
          );
          if (Array.isArray(nameRows) && nameRows[0]) {
            meta.departmentName =
              nameRows[0].department_name ||
              nameRows[0].name ||
              nameRows[0].department ||
              String(nameRows[0]).slice(0, 100);
          }
        } catch (e) {}
      }
      if (!meta.departmentName) {
        try {
          const rowsDept = await reportUtils.fetchRows(
            "SELECT name FROM departments WHERE id = ? LIMIT 1",
            [depId]
          );
          if (Array.isArray(rowsDept) && rowsDept[0] && rowsDept[0].name) {
            meta.departmentName = String(rowsDept[0].name);
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  try {
    const typedEmployeeName = coerceToString(
      req.query && (req.query.employee_name || req.query.employeeName),
      null
    );
    if (typedEmployeeName) {
      meta.employeeName = typedEmployeeName;
    } else {
      const empId = coerceToString(
        req.query && (req.query.employee_id || req.query.employeeId),
        null
      );
      if (empId) {
        if (queries && queries.GET_EMPLOYEE_NAME_BY_ID) {
          try {
            const empRows = await reportUtils.fetchRows(
              queries.GET_EMPLOYEE_NAME_BY_ID,
              [empId]
            );
            if (Array.isArray(empRows) && empRows[0]) {
              meta.employeeName =
                empRows[0].employee_name ||
                (empRows[0].first_name || "") +
                  " " +
                  (empRows[0].last_name || "");
            }
          } catch (e) {}
        }
        if (!meta.employeeName) {
          try {
            const en = await reportUtils.fetchRows(
              "SELECT CONCAT(COALESCE(first_name,''),' ',COALESCE(last_name,'')) AS employee_name FROM employees WHERE employee_id = ? LIMIT 1",
              [empId]
            );
            if (Array.isArray(en) && en[0] && en[0].employee_name) {
              meta.employeeName = String(en[0].employee_name).trim();
            }
          } catch (e) {}
        }
      }
    }
  } catch (e) {}

  const out = { rows: outRows, totalRows };
  if (message && typeof message === "string" && message.trim().length > 0) {
    out.message = message;
  } else if (safeRows.length === 0) {
    out.message = "No data for selected date range";
  }
  if (Object.keys(meta).length > 0) out.meta = meta;

  res.setHeader("Content-Type", "application/json");
  return res.status(200).json(out);
}

function safeFilename(base, ext) {
  const now = new Date().toISOString().replace(/[:.]/g, "-");
  return `${base}_${now}.${ext}`;
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
  if (!s || !e)
    return { ok: false, message: "Invalid date format. Use YYYY-MM-DD." };
  if (s > e)
    return { ok: false, message: "Start date cannot be after End date." };
  const numDays = daysBetweenInclusive(startDate, endDate);
  if (numDays > MAX_RANGE_DAYS) {
    return {
      ok: false,
      message: `Requested range is too large: ${numDays} days. Maximum allowed range is ${MAX_RANGE_DAYS} days (≈ 2 months).`,
    };
  }
  return { ok: true, startDate, endDate };
}

function parseDates(q) {
  const rawFormat = coerceToString(q.format, "xlsx");
  const format = (rawFormat || "xlsx").toLowerCase();

  const rawStatus = coerceToString(q.status, null);
  const statusCandidate = rawStatus || null;
  const status = normalizeStatusForQuery(statusCandidate);

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
    status: status || null,
    format,
    fields,
  };
}

module.exports = {
  coerceToString,
  escapeHtml,
  parseDates,
  ensureTwoMonthWindow,
  parseDateISO,
  daysBetweenInclusive,
  MAX_RANGE_DAYS,
  isPreviewRequest,
  sendPreviewResponse,
  safeFilename,
  normalizeStatusForQuery,
  buildDateStatusParams,
  keepOnlyFields,
  pickFields,
  normalizeReimbursementRow,
  applyEmployeeAndDepartmentFilters,
  normalizeForCompare,
  statusMatches,
};
