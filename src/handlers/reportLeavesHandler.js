const reportService = require("../services/reportIndex");
const { coerceToString, fetchRows } = require("../services/reportUtils");
const {
  parseDates,
  ensureTwoMonthWindow,
  isPreviewRequest,
  sendPreviewResponse,
} = require("../services/reportFilters");

function tryParseCandidate(raw) {
  if (raw === null || typeof raw === "undefined") return null;
  if (typeof raw === "object") {
    try {
      return (
        coerceToString(raw.employee_id, null) ||
        coerceToString(raw.employeeId, null) ||
        coerceToString(raw.id, null) ||
        coerceToString(raw.user_id, null) ||
        coerceToString(raw.email, null) ||
        null
      );
    } catch (e) {}
  }
  const s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith("{")) {
    try {
      const parsed = JSON.parse(s);
      if (parsed) {
        return (
          coerceToString(parsed.employee_id, null) ||
          coerceToString(parsed.employeeId, null) ||
          coerceToString(parsed.id, null) ||
          coerceToString(parsed.user_id, null) ||
          coerceToString(parsed.email, null) ||
          null
        );
      }
    } catch (e) {}
  }
  return s;
}
function findEmployeeIdInRequest(req) {
  try {
    const headerCandidates = [
      "x-employee-id",
      "x-employeeid",
      "x-emp-id",
      "x-user-id",
      "x-user",
    ];
    for (const h of headerCandidates) {
      const raw = req.headers && req.headers[h];
      const candidate = tryParseCandidate(raw);
      if (candidate) return candidate;
    }
    const r1 = req.employeeId ?? req.employee_id ?? req.userId ?? req.user_id;
    const cand1 = tryParseCandidate(r1);
    if (cand1) return cand1;
    const u = req.user || req.authUser || req.session?.user;
    if (u) {
      const cand =
        coerceToString(u.employee_id, null) ||
        coerceToString(u.employeeId, null) ||
        coerceToString(u.id, null) ||
        coerceToString(u.user_id, null) ||
        coerceToString(u.email, null);
      if (cand) return cand;
    }
    const qCandidate =
      tryParseCandidate(
        req.query &&
          (req.query.employee_id || req.query.employeeId || req.query.employee),
      ) ||
      tryParseCandidate(
        req.body &&
          (req.body.employee_id || req.body.employeeId || req.body.employee),
      );
    if (qCandidate) return qCandidate;
  } catch (e) {}
  return null;
}

async function findDepartmentsManagedBy(managerEmpId) {
  if (!managerEmpId) return [];
  const out = [];

  try {
    const cols = await fetchRows("SHOW COLUMNS FROM departments");
    const colNames = Array.isArray(cols)
      ? cols
          .map((c) => {
            return String(
              c.Field || c.field || c.COLUMN_NAME || c.column_name || "",
            ).trim();
          })
          .filter(Boolean)
      : [];

    if (colNames.includes("manager_employee_id")) {
      try {
        const rows = await fetchRows(
          "SELECT id FROM departments WHERE manager_employee_id = ?",
          [managerEmpId],
        );
        if (Array.isArray(rows)) {
          for (const r of rows) if (r && r.id != null) out.push(String(r.id));
          if (out.length) return Array.from(new Set(out));
        }
      } catch (e) {
        console.warn(
          "[reportLeavesHandler] query on manager_employee_id failed:",
          e && e.message,
        );
      }
    }

    if (colNames.includes("manager_id")) {
      try {
        const rows = await fetchRows(
          "SELECT id FROM departments WHERE manager_id = ?",
          [managerEmpId],
        );
        if (Array.isArray(rows)) {
          for (const r of rows) if (r && r.id != null) out.push(String(r.id));
          if (out.length) return Array.from(new Set(out));
        }
      } catch (e) {
        console.warn(
          "[reportLeavesHandler] query on manager_id failed:",
          e && e.message,
        );
      }
    }
  } catch (e) {
    console.warn("[reportLeavesHandler] SHOW COLUMNS failed:", e && e.message);
  }

  try {
    const rows = await fetchRows(
      "SELECT DISTINCT department_id AS id FROM employee_professional WHERE supervisor_id = ? AND department_id IS NOT NULL",
      [managerEmpId],
    );
    if (Array.isArray(rows) && rows.length) {
      for (const r of rows) {
        const id = r && (r.id ?? r.department_id);
        if (id != null) out.push(String(id));
      }
    }
  } catch (e) {
    console.warn(
      "[reportLeavesHandler] fallback department query failed:",
      e && e.message,
    );
  }

  return Array.from(new Set(out));
}

function normalizeToPlainString(candidate, kind = "generic") {
  if (candidate === null || typeof candidate === "undefined") return null;
  if (typeof candidate === "object") {
    const o = candidate;
    if (o.employee_name || o.name || o.first_name || o.last_name) {
      const name =
        o.employee_name ||
        `${(o.first_name || "").trim()} ${(o.last_name || "").trim()}`.trim() ||
        o.name ||
        null;
      const id = o.employee_id || o.employeeId || o.id || null;
      return id && name ? `${name} (${id})` : name || String(id || "");
    }
    if (o.department_name || o.name) {
      return o.department_name || o.name || (o.id ? String(o.id) : null);
    }
    try {
      return JSON.stringify(o);
    } catch (e) {
      return String(o);
    }
  }
  if (typeof candidate === "string" && candidate.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(candidate);
      return normalizeToPlainString(parsed, kind);
    } catch (e) {}
  }
  return String(candidate);
}

async function buildMetaFromReqQuery(query = {}) {
  const meta = {
    filters: [],
    status: null,
    employee: null,
    department: null,
  };

  try {
    const startDate =
      coerceToString(query.startDate, null) ||
      coerceToString(query.start_date, null) ||
      coerceToString(query.from, null) ||
      coerceToString(query.fromDate, null);
    const endDate =
      coerceToString(query.endDate, null) ||
      coerceToString(query.end_date, null) ||
      coerceToString(query.to, null) ||
      coerceToString(query.toDate, null);
    if (startDate || endDate) {
      if (startDate && endDate)
        meta.filters.push(`Date: ${startDate} → ${endDate}`);
      else if (startDate) meta.filters.push(`From: ${startDate}`);
      else meta.filters.push(`To: ${endDate}`);
    }

    const rawStatus =
      coerceToString(query.status, null) ||
      coerceToString(query.approval_status, null) ||
      coerceToString(query.state, null);
    if (rawStatus) {
      meta.status = normalizeToPlainString(rawStatus, "status");
      meta.filters.push(`Status: ${meta.status}`);
    }

    let empCandidate =
      query.employee_id ?? query.employeeId ?? query.employee ?? null;
    if (typeof empCandidate === "string" && empCandidate.trim() === "")
      empCandidate = null;

    if (empCandidate) {
      const idCandidate = tryParseCandidate(empCandidate);
      if (idCandidate) {
        try {
          const rows = await fetchRows(
            "SELECT employee_id, first_name, last_name, email FROM employees WHERE employee_id = ? LIMIT 1",
            [idCandidate],
          );
          const er = Array.isArray(rows) && rows[0] ? rows[0] : null;
          if (er) {
            const name =
              `${(er.first_name || "").trim()} ${(
                er.last_name || ""
              ).trim()}`.trim() ||
              er.email ||
              er.employee_id;
            meta.employee = `${name} (${er.employee_id})`;
            meta.employeeName = name;
            meta.employeeId = er.employee_id;
            meta.filters.push(`Employee: ${meta.employee}`);
          } else {
            meta.employee = normalizeToPlainString(empCandidate, "employee");
            meta.employeeName = meta.employee;
            meta.filters.push(`Employee: ${meta.employee}`);
          }
        } catch (e) {
          meta.employee = normalizeToPlainString(empCandidate, "employee");
          meta.employeeName = meta.employee;
          meta.filters.push(`Employee: ${meta.employee}`);
        }
      } else {
        meta.employee = normalizeToPlainString(empCandidate, "employee");
        meta.employeeName = meta.employee;
        meta.filters.push(`Employee: ${meta.employee}`);
      }
    }

    let deptCandidate =
      query.department_id ?? query.departmentId ?? query.department ?? null;
    if (typeof deptCandidate === "string" && deptCandidate.trim() === "")
      deptCandidate = null;

    if (deptCandidate) {
      const deptIdStr = coerceToString(deptCandidate, null);
      if (deptIdStr && /^\d+$/.test(String(deptIdStr))) {
        try {
          const rows = await fetchRows(
            "SELECT id, name FROM departments WHERE id = ? LIMIT 1",
            [deptIdStr],
          );
          const dr = Array.isArray(rows) && rows[0] ? rows[0] : null;
          if (dr) {
            meta.department = `${dr.name}`;
            meta.filters.push(`Department: ${meta.department}`);
          } else {
            meta.department = normalizeToPlainString(
              deptCandidate,
              "department",
            );
            meta.filters.push(`Department: ${meta.department}`);
          }
        } catch (e) {
          meta.department = normalizeToPlainString(deptCandidate, "department");
          meta.filters.push(`Department: ${meta.department}`);
        }
      } else {
        meta.department = normalizeToPlainString(deptCandidate, "department");
        meta.filters.push(`Department: ${meta.department}`);
      }
    }

    if (meta.filters.length === 0) meta.filters.push("No explicit filters");
  } catch (e) {
    console.warn(
      "[reportLeavesHandler] buildMetaFromReqQuery failed:",
      e && e.message,
    );
    if (meta.filters.length === 0)
      meta.filters.push("No explicit filters (meta build failed)");
  }
  return meta;
}

function isExplicitManagerScope(req) {
  try {
    const header = String(
      (req.headers && (req.headers["x-force-manager-scope"] || "")) || "",
    ).toLowerCase();
    const q1 = String(
      (req.query &&
        (req.query.forceManager ||
          req.query.manager_scope ||
          req.query.managerScope ||
          "")) ||
        "",
    ).toLowerCase();
    if (header === "1" || header === "true") return true;
    if (q1 === "1" || q1 === "true") return true;
    const u = req.user || req.authUser || req.session?.user;
    if (u && u.role && /manager|supervisor|lead/i.test(String(u.role)))
      return true;
  } catch (e) {}
  return false;
}

async function downloadLeavesReport(req, res) {
  try {
    const parsed = parseDates(req.query || {});
    let { startDate, endDate, status, format, fields } = parsed;

    const employeeIdQuery = coerceToString(
      req.query.employee_id ?? req.query.employeeId ?? req.query.employee,
      null,
    );
    let departmentIdQuery = coerceToString(
      req.query.department_id ?? req.query.departmentId ?? req.query.department,
      null,
    );

    const requesterEmpId = findEmployeeIdInRequest(req);
    if (requesterEmpId)
      console.debug(
        "[reportLeavesHandler] requester employee id discovered:",
        requesterEmpId,
      );

    let isAdmin = false;
    try {
      const u = req.user || req.authUser || req.session?.user;
      if (u) {
        const userRole = u.role || u.user_role;
        const lowerRole = userRole ? String(userRole).toLowerCase() : "";
        isAdmin = !!(
          u.is_admin ||
          u.isAdmin ||
          lowerRole === "admin" ||
          lowerRole === "hr" ||
          lowerRole === "human resources" ||
          (Array.isArray(u.roles) && u.roles.includes("admin"))
        );
      }
    } catch (e) {
      isAdmin = false;
    }

    let managerEmpId = null;
    if (!departmentIdQuery && requesterEmpId && !isAdmin) {
      try {
        const r = await fetchRows(
          "SELECT department_id FROM employee_professional WHERE employee_id = ? LIMIT 1",
          [requesterEmpId],
        );
        if (Array.isArray(r) && r[0] && r[0].department_id != null) {
          departmentIdQuery = String(r[0].department_id);
          console.debug(
            "[reportLeavesHandler] derived department for requester:",
            departmentIdQuery,
          );
        } else {
          if (isExplicitManagerScope(req)) {
            managerEmpId = requesterEmpId;
            console.debug(
              "[reportLeavesHandler] explicit manager scoping enabled via flag/role:",
              managerEmpId,
            );
          } else {
            console.debug(
              "[reportLeavesHandler] skipping manager scoping for requester (no explicit scope or admin)",
            );
          }
        }
      } catch (e) {
        if (isExplicitManagerScope(req)) {
          managerEmpId = requesterEmpId;
          console.debug(
            "[reportLeavesHandler] fallback: explicit manager scoping enabled via flag/role:",
            managerEmpId,
          );
        } else {
          console.debug(
            "[reportLeavesHandler] skipping manager scoping for requester (derivation failed)",
          );
        }
      }
    }

    const ensured = ensureTwoMonthWindow(startDate, endDate);
    if (!ensured.ok) return res.status(400).json({ message: ensured.message });
    startDate = ensured.startDate;
    endDate = ensured.endDate;

    let rows = [];

    if (employeeIdQuery || departmentIdQuery) {
      rows = await reportService.getLeaveRows(
        startDate,
        endDate,
        status,
        fields,
        employeeIdQuery,
        departmentIdQuery,
      );
      rows = Array.isArray(rows) ? rows : [];
    } else if (managerEmpId) {
      let managedDeptIds = [];
      try {
        managedDeptIds = await findDepartmentsManagedBy(managerEmpId);
      } catch (e) {
        console.warn(
          "[reportLeavesHandler] findDepartmentsManagedBy attempt failed:",
          e && e.message,
        );
      }

      if (managedDeptIds.length > 0) {
        const merged = [];
        for (const d of managedDeptIds) {
          try {
            const part = await reportService.getLeaveRows(
              startDate,
              endDate,
              status,
              fields,
              null,
              d,
            );
            if (Array.isArray(part) && part.length) merged.push(...part);
          } catch (e) {
            console.warn(
              "[reportLeavesHandler] per-dept getLeaveRows failed for dept",
              d,
              e && e.message,
            );
          }
        }
        const map = new Map();
        for (const p of merged)
          if (p && p.leave_id) map.set(String(p.leave_id), p);
        rows = Array.from(map.values());
      } else {
        try {
          const all = await reportService.getLeaveRows(
            startDate,
            endDate,
            status,
            fields,
          );
          const allArr = Array.isArray(all) ? all : [];
          const empIds = Array.from(
            new Set(allArr.map((x) => x.employee_id).filter(Boolean)),
          );
          if (empIds.length) {
            const placeholders = empIds.map(() => "?").join(",");
            const profRows = await fetchRows(
              `SELECT employee_id, supervisor_id FROM employee_professional WHERE employee_id IN (${placeholders})`,
              empIds,
            );
            const supMap = {};
            for (const pr of Array.isArray(profRows) ? profRows : []) {
              if (pr && pr.employee_id)
                supMap[String(pr.employee_id)] = pr.supervisor_id;
            }
            rows = allArr.filter((r) => {
              const id = r.employee_id ? String(r.employee_id) : null;
              const sup = id ? supMap[id] : null;
              return sup != null && String(sup) === String(managerEmpId);
            });
          } else rows = [];
        } catch (e) {
          console.error(
            "[reportLeavesHandler] fallback JS filtering failed:",
            e && e.message,
          );
          rows = [];
        }
      }
    } else {
      rows = await reportService.getLeaveRows(
        startDate,
        endDate,
        status,
        fields,
      );
      rows = Array.isArray(rows) ? rows : [];
    }

    if (isPreviewRequest(req)) {
      console.debug(
        "[reportLeavesHandler] preview rows:",
        rows.length,
        "status param:",
        status,
      );
      const msg =
        rows.length === 0 ? "No leave data for selected date range" : undefined;
      return sendPreviewResponse(req, res, rows, msg);
    }

    if (!rows || rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No leave data for selected date range" });
    }

    const meta = await buildMetaFromReqQuery(req.query || {});
    console.debug("[reportLeavesHandler] PDF meta:", meta);

    if (format === "pdf") {
      if (typeof reportService.renderPdfBuffer !== "function")
        return res.status(500).json({ message: "PDF renderer not available" });
      const pdfBuf = await reportService.renderPdfBuffer(
        "Leaves Report",
        rows,
        { meta },
      );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="leaves_report.pdf"`,
      );
      res.setHeader("Content-Length", pdfBuf.length);
      return res.send(pdfBuf);
    } else if (format === "xlsx") {
      if (typeof reportService.renderExcelBuffer !== "function")
        return res
          .status(500)
          .json({ message: "Excel renderer not available" });
      const buf = await reportService.renderExcelBuffer(rows, null);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="leaves_report.xlsx"`,
      );
      res.setHeader("Content-Length", buf.length);
      return res.send(buf);
    } else {
      return res.status(400).json({ message: "Invalid format" });
    }
  } catch (err) {
    console.error(
      "[reportLeavesHandler] Error:",
      err && (err.stack || err.message),
    );
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = {
  downloadLeavesReport,
};
