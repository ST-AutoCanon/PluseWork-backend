const reportUtils = require("../services/reportUtils");
const reportService = require("../services/reportIndex");
const {
  parseDates,
  ensureTwoMonthWindow,
  isPreviewRequest,
  sendPreviewResponse,
  coerceToString,
  pickFields,
} = require("../services/reportFilters");

const INTERNAL_KEYS_TO_STRIP = new Set([
  "__asset_lifecycle_status",
  "__asset_assigned_entries",
  "__asset_has_active_assignment",
  "__asset_latest_event",
  "raw_status",
  "rawStatus",
  "lifecycle",
  "valuation_date",
  "count",
  "rawStatus",
  "raw_status",
]);

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
  const s = String(raw).trim();
  if (!s) return null;
  const norm = normalizeStringForSynonym(s);
  if (norm.indexOf("in use") !== -1 || norm.indexOf("inuse") !== -1)
    return "assigned";
  if (["assigned", "assignedto", "assigned_to"].includes(norm))
    return "assigned";
  if (["unassigned", "available", "notusing", "not using"].includes(norm))
    return "unassigned";
  if (norm.indexOf("return") !== -1 || norm === "returned") return "returned";
  if (norm.indexOf("decomm") !== -1 || norm.indexOf("decommission") !== -1)
    return "decommissioned";
  if (norm === "pending") return "pending";
  if (norm === "approved") return "approved";
  if (norm === "rejected") return "rejected";
  return norm || null;
}

function robustParseAssignedTo(raw) {
  try {
    if (raw === null || raw === undefined) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "object") return [raw];

    let s = String(raw).trim();
    if (!s) return [];

    const arrayMatch = s.match(/\[(?:[\s\S]*?)\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch (e) {
        try {
          const attempt = arrayMatch[0].replace(
            /(['"])??([a-zA-Z0-9_]+)\1\s*:/g,
            '"$2":',
          );
          return JSON.parse(attempt);
        } catch (e2) {}
      }
    }

    if (s.startsWith("{") && s.endsWith("}")) {
      try {
        return [JSON.parse(s)];
      } catch (e) {
        try {
          const replaced = s
            .replace(/'([^']*)'\s*:/g, '"$1":')
            .replace(/: '([^']*)'/g, ': "$1"');
          return [JSON.parse(replaced)];
        } catch (e2) {}
      }
    }

    if (s.indexOf("},{") !== -1 || s.indexOf("}{") !== -1) {
      try {
        let clean = s.replace(/^\[?/, "").replace(/\]?$/, "");
        const parts = clean.split(/}\s*,\s*{/);
        return parts.map((part, i) => {
          let txt = part;
          if (i !== 0) txt = "{" + txt;
          if (i !== parts.length - 1) txt = txt + "}";
          try {
            return JSON.parse(txt);
          } catch (e) {
            try {
              const safe = txt
                .replace(/'([^']*)'\s*:/g, '"$1":')
                .replace(/: '([^']*)'/g, ': "$1"');
              return JSON.parse(safe);
            } catch (e2) {
              return { raw: txt };
            }
          }
        });
      } catch (e) {}
    }

    return [{ raw: s }];
  } catch (e) {
    return [];
  }
}

function parseDateFlexible(d) {
  if (!d && d !== 0) return null;
  try {
    const s = String(d).trim();
    if (!s) return null;
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) return dt;
    const alt = s.replace(/\//g, "-");
    const dt2 = new Date(alt);
    return isNaN(dt2.getTime()) ? null : dt2;
  } catch (e) {
    return null;
  }
}

function analyzeAssignedEntries(entries) {
  const normalized = (Array.isArray(entries) ? entries : []).map((e) => {
    if (!e || typeof e !== "object") return { raw: String(e) };
    return {
      status: e.status || e.Status || e.assignmentStatus || null,
      returnDate: e.returnDate || e.return_date || null,
      startDate: e.startDate || e.start_date || null,
      name: e.name || e.assigneeName || null,
      employeeId: e.employeeId || e.employee_id || null,
      raw: e,
    };
  });

  const entriesWithStatus = normalized.filter(
    (x) => x && x.status && String(x.status).trim() !== "",
  );
  if (entriesWithStatus.length > 0) {
    let best = null;
    let bestTime = -Infinity;
    for (const en of entriesWithStatus) {
      const sd = parseDateFlexible(en.startDate);
      const rd = parseDateFlexible(en.returnDate);
      const candidateTime = Math.max(
        sd ? sd.getTime() : -Infinity,
        rd ? rd.getTime() : -Infinity,
      );
      if (candidateTime === -Infinity) {
        continue;
      }
      if (candidateTime > bestTime) {
        best = en;
        bestTime = candidateTime;
      }
    }
    if (!best) {
      best = entriesWithStatus[entriesWithStatus.length - 1];
    }

    const canon = canonicalizeStatusToken(best.status);
    const hasActive = canon === "assigned";
    return {
      lifecycle: canon || "unknown",
      hasActive: !!hasActive,
      entries: normalized,
      authoritativeEntry: best,
      latestEvent: {
        date: bestTime === -Infinity ? null : new Date(bestTime),
        type: best.returnDate ? "return" : "status",
        statusCanon: canon,
      },
    };
  }

  let anyActive = false;
  const events = [];
  const nowMs = Date.now();

  for (const ent of normalized) {
    const sCanon = canonicalizeStatusToken(
      ent && ent.status
        ? ent.status
        : ent.raw && ent.raw.status
          ? ent.raw.status
          : "",
    );
    const sd = parseDateFlexible(ent.startDate);
    const rd = parseDateFlexible(ent.returnDate);
    if (rd) events.push({ date: rd, type: "return", statusCanon: sCanon });
    if (sd) events.push({ date: sd, type: "start", statusCanon: sCanon });
    if (!sd && !rd && sCanon)
      events.push({ date: null, type: "status", statusCanon: sCanon });

    if (rd) {
      if (rd.getTime() > nowMs) anyActive = true;
      else continue;
    }
    if (sd && (!rd || String(rd).trim() === "")) {
      anyActive = true;
      continue;
    }
    if (ent.employeeId && (!rd || String(rd).trim() === "")) {
      anyActive = true;
      continue;
    }
    if (
      ["assigned", "in use", "allocated", "issued", "using"].includes(sCanon)
    ) {
      anyActive = true;
      continue;
    }
  }

  let lifecycle = anyActive ? "assigned" : "unassigned";
  if (!anyActive) {
    const dated = events
      .filter((e) => e.date)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    if (dated.length) {
      const top = dated[0];
      if (top.type === "return" || top.statusCanon === "returned")
        lifecycle = "returned";
      else if (top.statusCanon === "decommissioned")
        lifecycle = "decommissioned";
      else lifecycle = top.statusCanon || lifecycle;
    } else if (normalized.length && normalized[normalized.length - 1].raw) {
      const last = normalized[normalized.length - 1];
      const lc = canonicalizeStatusToken(
        last.status || (typeof last.raw === "string" ? last.raw : ""),
      );
      if (lc) lifecycle = lc;
    }
  }

  if (
    ![
      "assigned",
      "returned",
      "unassigned",
      "decommissioned",
      "unknown",
    ].includes(lifecycle)
  ) {
    const lc = String(lifecycle || "").toLowerCase();
    if (lc.indexOf("decomm") !== -1) lifecycle = "decommissioned";
    else if (lc.indexOf("return") !== -1) lifecycle = "returned";
    else if (lc.indexOf("assign") !== -1 || lc.indexOf("in use") !== -1)
      lifecycle = "assigned";
    else lifecycle = lc || "unknown";
  }

  return {
    lifecycle,
    hasActive: !!anyActive,
    entries: normalized,
    latestEvent: null,
  };
}

function lifecycleLabelFromToken(tok) {
  if (!tok) return "";
  const t = String(tok).toLowerCase();
  if (t === "assigned") return "Assigned";
  if (t === "unassigned") return "Unassigned";
  if (t === "returned") return "Returned";
  if (t === "decommissioned") return "Decommissioned";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

async function downloadAssetsReport(req, res) {
  try {
    const q = parseDates(req.query || {});
    const windowCheck = ensureTwoMonthWindow(q.startDate, q.endDate);
    if (!windowCheck.ok) {
      return res.status(400).json({ message: windowCheck.message });
    }
    const startDate = windowCheck.startDate;
    const endDate = windowCheck.endDate;

    const sql = `
      SELECT
        a.asset_id,
        a.asset_name,
        a.configuration,
        a.valuation_date,
        a.assigned_to,
        a.document_path,
        DATE_FORMAT(a.created_at, '%Y-%m-%d') AS created_at,
        a.category,
        a.sub_category,
        a.status,
        a.count,
        a.asset_code
      FROM assets a
      WHERE ( ? IS NULL OR (COALESCE(a.created_at, a.valuation_date, NOW()) >= ? ) )
        AND ( ? IS NULL OR (COALESCE(a.created_at, a.valuation_date, NOW()) < DATE_ADD(?, INTERVAL 1 DAY) ) )
      ORDER BY COALESCE(a.created_at, a.valuation_date, NOW()) DESC
    `;
    const params = [startDate, startDate, endDate, endDate];
    const rows = (await reportUtils.fetchRows(sql, params)) || [];

    const rawStatus = coerceToString(req.query && req.query.status, null);
    const requestedStatusToken = rawStatus
      ? canonicalizeStatusToken(rawStatus)
      : null;

    const normalizedRows = rows.map((r) => {
      const row = Object.assign({}, r);
      try {
        const parsed = robustParseAssignedTo(row.assigned_to);
        const analyzed = analyzeAssignedEntries(parsed);
        row.__asset_assigned_entries = analyzed.entries;
        row.__asset_lifecycle_status = analyzed.lifecycle;
        row.__asset_has_active_assignment = !!analyzed.hasActive;
        row.__asset_latest_event = analyzed.latestEvent || null;
      } catch (e) {
        row.__asset_assigned_entries = [];
        row.__asset_lifecycle_status = "unassigned";
        row.__asset_has_active_assignment = false;
        row.__asset_latest_event = null;
      }
      return row;
    });

    const filtered = normalizedRows.filter((r) => {
      if (!requestedStatusToken) return true;
      const req = String(requestedStatusToken).toLowerCase();
      const lifecycle = (r.__asset_lifecycle_status || "").toLowerCase();
      if (
        ["assigned", "unassigned", "returned", "decommissioned"].includes(req)
      ) {
        return lifecycle === req;
      }
      if (lifecycle && lifecycle.indexOf(req) !== -1) return true;
      if (
        r.assigned_to &&
        typeof r.assigned_to === "string" &&
        r.assigned_to.toLowerCase().indexOf(req) !== -1
      )
        return true;
      return false;
    });

    if (isPreviewRequest(req)) {
      return sendPreviewResponse(req, res, filtered);
    }

    let exportFields = null;
    if (Array.isArray(q.fields) && q.fields.length > 0) {
      exportFields = q.fields
        .filter((f) => f && !INTERNAL_KEYS_TO_STRIP.has(String(f)))
        .map((f) => String(f));
    } else {
      exportFields = [
        "asset_id",
        "asset_name",
        "configuration",
        "assigned_to",
        "document_path",
        "created_at",
        "category",
        "sub_category",
        "status",
        "asset_code",
      ];
    }

    exportFields = exportFields.filter(
      (f) => f && !INTERNAL_KEYS_TO_STRIP.has(String(f)),
    );

    if (!Array.isArray(exportFields) || exportFields.length === 0) {
      exportFields = [
        "asset_id",
        "asset_name",
        "configuration",
        "assigned_to",
        "document_path",
        "created_at",
        "category",
        "sub_category",
        "status",
        "asset_code",
      ];
    }

    const preparedForExport = filtered.map((r) => {
      const copy = Object.assign({}, r);

      if (exportFields.includes("status")) {
        const canon = copy.__asset_lifecycle_status || copy.lifecycle || null;
        copy.status = lifecycleLabelFromToken(canon);
      }

      for (const k of Object.keys(copy)) {
        if (INTERNAL_KEYS_TO_STRIP.has(k)) {
          try {
            delete copy[k];
          } catch (e) {}
        }
      }

      if (
        !exportFields.includes("valuation_date") &&
        copy.hasOwnProperty("valuation_date")
      ) {
        try {
          delete copy.valuation_date;
        } catch (e) {}
      }
      if (!exportFields.includes("count") && copy.hasOwnProperty("count")) {
        try {
          delete copy.count;
        } catch (e) {}
      }

      return copy;
    });

    const prunedRows = pickFields(preparedForExport, exportFields);

    const fmt = (q.format || "").toLowerCase();
    if (fmt === "pdf") {
      if (typeof reportService.renderPdfBuffer === "function") {
        try {
          const meta = {
            status: coerceToString(req.query && req.query.status, null) || null,
            startDate: q.startDate || null,
            endDate: q.endDate || null,
          };
          const pdfBuf = await reportService.renderPdfBuffer(
            "Assets Report",
            prunedRows,
            { meta },
          );
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="assets_report.pdf"`,
          );
          res.setHeader("Content-Length", pdfBuf.length);
          return res.send(pdfBuf);
        } catch (e) {
          console.warn(
            "[reportAssetsHandler] PDF render failed, falling back to JSON:",
            e && e.message,
          );
        }
      } else {
        console.warn(
          "[reportAssetsHandler] PDF renderer not available, returning JSON fallback.",
        );
      }
    } else if (fmt === "xlsx") {
      if (typeof reportService.renderExcelBuffer === "function") {
        try {
          const buf = await reportService.renderExcelBuffer(prunedRows, {
            filename: "assets_report.xlsx",
          });
          res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          );
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="assets_report.xlsx"`,
          );
          res.setHeader("Content-Length", buf.length);
          return res.send(buf);
        } catch (e) {
          console.warn(
            "[reportAssetsHandler] Excel render failed, falling back to JSON:",
            e && e.message,
          );
        }
      } else {
        console.warn(
          "[reportAssetsHandler] Excel renderer not available, returning JSON fallback.",
        );
      }
    }

    res.setHeader("Content-Type", "application/json");
    return res
      .status(200)
      .json({ rows: prunedRows, totalRows: prunedRows.length });
  } catch (err) {
    console.error(
      "[reportAssetsHandler] error:",
      err && (err.stack || err.message),
    );
    return res
      .status(500)
      .json({ message: "Server error fetching asset report" });
  }
}

module.exports = { downloadAssetsReport };