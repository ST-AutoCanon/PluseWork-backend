const reportService = require("../services/reportIndex");
const { coerceToString, fetchRows } = require("../services/reportUtils");
const {
  parseDates,
  ensureTwoMonthWindow,
  isPreviewRequest,
  sendPreviewResponse,
  safeFilename,
  pickFields,
} = require("../services/reportFilters");
const { getDbPool } = require("../utils/tenantDb");

async function dbExecRaw(req, sql, params = []) {
  const pool = await getDbPool(req);
  if (!Array.isArray(params)) params = [params];

  if (pool && typeof pool.execute === "function") {
    return await pool.execute(sql, params);
  }
  if (pool && typeof pool.query === "function") {
    return await pool.query(sql, params);
  }

  return new Promise((resolve, reject) => {
    if (pool && typeof pool.query === "function") {
      pool.query(sql, params, (err, rows, fields) => {
        if (err) return reject(err);
        resolve([rows, fields]);
      });
    } else reject(new Error("DB client missing execute/query"));
  });
}

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

async function findDepartmentsManagedBy(req, managerEmpId) {
  if (!managerEmpId) return [];
  const out = [];
  try {
    const cols = await fetchRows("SHOW COLUMNS FROM departments");
    const colNames = Array.isArray(cols)
      ? cols
          .map((c) =>
            String(
              c.Field || c.field || c.COLUMN_NAME || c.column_name || "",
            ).trim(),
          )
          .filter(Boolean)
      : [];

    if (colNames.includes("manager_employee_id")) {
      try {
        const [rows] = await dbExecRaw(
          req,
          "SELECT id FROM departments WHERE manager_employee_id = ?",
          [managerEmpId],
        );
        if (Array.isArray(rows) && rows.length) {
          for (const r of rows) if (r && r.id != null) out.push(String(r.id));
          if (out.length) return Array.from(new Set(out));
        }
      } catch (e) {
        console.warn(
          "[reportEmployeesHandler] query on manager_employee_id failed:",
          e && e.message,
        );
      }
    }

    if (colNames.includes("manager_id")) {
      try {
        const [rows] = await dbExecRaw(
          req,
          "SELECT id FROM departments WHERE manager_id = ?",
          [managerEmpId],
        );
        if (Array.isArray(rows) && rows.length) {
          for (const r of rows) if (r && r.id != null) out.push(String(r.id));
          if (out.length) return Array.from(new Set(out));
        }
      } catch (e) {
        console.warn(
          "[reportEmployeesHandler] query on manager_id failed:",
          e && e.message,
        );
      }
    }
  } catch (e) {
    console.warn(
      "[reportEmployeesHandler] SHOW COLUMNS failed:",
      e && e.message,
    );
  }

  try {
    const [rows] = await dbExecRaw(
      req,
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
      "[reportEmployeesHandler] fallback department query failed:",
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

    const typedEmployeeName =
      coerceToString(query.employee_name, null) ||
      coerceToString(query.employeeName, null) ||
      coerceToString(query.employee, null);

    const rawEmpId = query.employee_id ?? query.employeeId ?? null;
    const empId = coerceToString(rawEmpId, null);

    if (empId) {
      const idCandidate = tryParseCandidate(empId);
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
          } else if (typedEmployeeName) {
            // Try to resolve the name to employee id
            try {
              const nameRows = await fetchRows(
                "SELECT employee_id, first_name, last_name, email FROM employees WHERE CONCAT(first_name, ' ', last_name) LIKE ? OR email LIKE ? LIMIT 1",
                [`%${typedEmployeeName}%`, `%${typedEmployeeName}%`],
              );
              if (Array.isArray(nameRows) && nameRows[0]) {
                const er2 = nameRows[0];
                const name2 =
                  `${(er2.first_name || "").trim()} ${(er2.last_name || "").trim()}`.trim() ||
                  er2.email ||
                  er2.employee_id;
                meta.employee = `${name2} (${er2.employee_id})`;
                meta.employeeName = name2;
                meta.employeeId = er2.employee_id;
                meta.filters.push(`Employee: ${meta.employee}`);
                // Set the resolved id back to query for the handler
                query.employee_id = er2.employee_id;
              } else {
                meta.employee = `${typedEmployeeName} (${idCandidate})`;
                meta.employeeName = typedEmployeeName;
                meta.employeeId = idCandidate;
                meta.filters.push(`Employee: ${meta.employee}`);
              }
            } catch (e2) {
              meta.employee = `${typedEmployeeName} (${idCandidate})`;
              meta.employeeName = typedEmployeeName;
              meta.employeeId = idCandidate;
              meta.filters.push(`Employee: ${meta.employee}`);
            }
          } else {
            meta.employee = `${idCandidate}`;
            meta.employeeName = `${idCandidate}`;
            meta.employeeId = idCandidate;
            meta.filters.push(`Employee: ${meta.employee}`);
          }
        } catch (e) {
          if (typedEmployeeName) {
            // Try to resolve the name to employee id
            try {
              const nameRows = await fetchRows(
                "SELECT employee_id, first_name, last_name, email FROM employees WHERE CONCAT(first_name, ' ', last_name) LIKE ? OR email LIKE ? LIMIT 1",
                [`%${typedEmployeeName}%`, `%${typedEmployeeName}%`],
              );
              if (Array.isArray(nameRows) && nameRows[0]) {
                const er2 = nameRows[0];
                const name2 =
                  `${(er2.first_name || "").trim()} ${(er2.last_name || "").trim()}`.trim() ||
                  er2.email ||
                  er2.employee_id;
                meta.employee = `${name2} (${er2.employee_id})`;
                meta.employeeName = name2;
                meta.employeeId = er2.employee_id;
                meta.filters.push(`Employee: ${meta.employee}`);
                // Set the resolved id back to query for the handler
                query.employee_id = er2.employee_id;
              } else {
                meta.employee = `${typedEmployeeName} (${idCandidate})`;
                meta.employeeName = typedEmployeeName;
                meta.employeeId = idCandidate;
                meta.filters.push(`Employee: ${meta.employee}`);
              }
            } catch (e2) {
              meta.employee = `${typedEmployeeName} (${idCandidate})`;
              meta.employeeName = typedEmployeeName;
              meta.employeeId = idCandidate;
              meta.filters.push(`Employee: ${meta.employee}`);
            }
          } else {
            meta.employee = `${idCandidate}`;
            meta.employeeName = `${idCandidate}`;
            meta.employeeId = idCandidate;
            meta.filters.push(`Employee: ${meta.employee}`);
          }
        }
      }
    } else if (typedEmployeeName) {
      meta.employee = typedEmployeeName;
      meta.employeeName = typedEmployeeName;
      meta.filters.push(`Employee: ${typedEmployeeName}`);
    }

    let deptCandidate =
      query.department_id ??
      query.departmentId ??
      query.department ??
      query.department_name ??
      query.departmentName ??
      null;
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

    // Normalize employee metadata to a consistent display form:
    // - Prefer combined "Name (ID)" where both exist.
    // - Fall back gracefully if only one is available.
    const finalEmployeeName =
      meta.employeeName || meta.employee_name || meta.employee || null;
    const finalEmployeeId = meta.employeeId || meta.employee_id || null;

    if (finalEmployeeName && finalEmployeeId) {
      const name = String(finalEmployeeName).trim();
      const id = String(finalEmployeeId).trim();
      if (name && id && !name.includes(id)) {
        meta.employee = `${name} (${id})`;
      } else {
        meta.employee = name;
      }
      meta.employeeName = name;
      meta.employeeId = id;
    } else if (finalEmployeeName) {
      meta.employee = String(finalEmployeeName).trim();
      meta.employeeName = meta.employee;
      if (finalEmployeeId) meta.employeeId = String(finalEmployeeId).trim();
    } else if (finalEmployeeId) {
      meta.employee = String(finalEmployeeId).trim();
      meta.employeeId = meta.employee;
      if (!meta.employeeName) meta.employeeName = meta.employee;
    }

    if (meta.department && !meta.departmentName) {
      meta.departmentName = meta.department;
    }
  } catch (e) {
    console.warn(
      "[reportEmployeesHandler] buildMetaFromReqQuery failed:",
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

async function downloadEmployeesReport(req, res) {
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
        "[reportEmployeesHandler] requester employee id discovered:",
        requesterEmpId,
      );

    let isAdmin = false;
    try {
      const u = req.user || req.authUser || req.session?.user;
      if (u) {
        const userRole = u.role ? String(u.role).toLowerCase() : "";
        isAdmin = !!(
          u.is_admin ||
          u.isAdmin ||
          userRole === "admin" ||
          userRole === "hr" ||
          userRole === "human resources" ||
          (Array.isArray(u.roles) && u.roles.includes("admin"))
        );
      }
    } catch (e) {
      isAdmin = false;
    }

    let managerEmpId = null;
    if (!departmentIdQuery && requesterEmpId) {
      try {
        const [r] = await dbExecRaw(
          "SELECT department_id FROM employee_professional WHERE employee_id = ? LIMIT 1",
          [requesterEmpId],
        );
        if (Array.isArray(r) && r[0] && r[0].department_id != null) {
          departmentIdQuery = String(r[0].department_id);
          console.debug(
            "[reportEmployeesHandler] derived department for requester:",
            departmentIdQuery,
          );
        } else {
          if (
            !isAdmin &&
            !isPreviewRequest(req) &&
            isExplicitManagerScope(req)
          ) {
            managerEmpId = requesterEmpId;
            console.debug(
              "[reportEmployeesHandler] explicit manager scoping enabled via flag/role:",
              managerEmpId,
            );
          } else {
            console.debug(
              "[reportEmployeesHandler] skipping manager scoping for requester (no explicit scope or admin/preview)",
            );
          }
        }
      } catch (e) {
        if (!isAdmin && !isPreviewRequest(req) && isExplicitManagerScope(req)) {
          managerEmpId = requesterEmpId;
          console.debug(
            "[reportEmployeesHandler] fallback: explicit manager scoping enabled via flag/role:",
            managerEmpId,
          );
        } else {
          console.debug(
            "[reportEmployeesHandler] skipping manager scoping for requester (derivation failed)",
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
      rows = await reportService.getEmployeeRows(
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
        managedDeptIds = await findDepartmentsManagedBy(req, managerEmpId);
      } catch (e) {
        console.warn(
          "[reportEmployeesHandler] findDepartmentsManagedBy attempt failed:",
          e && e.message,
        );
      }

      if (managedDeptIds.length > 0) {
        const merged = [];
        for (const d of managedDeptIds) {
          try {
            const part = await reportService.getEmployeeRows(
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
              "[reportEmployeesHandler] per-dept getEmployeeRows failed for dept",
              d,
              e && e.message,
            );
          }
        }
        const map = new Map();
        for (const p of merged)
          if (p && p.employee_id) map.set(String(p.employee_id), p);
        rows = Array.from(map.values());
      } else {
        try {
          const all = await reportService.getEmployeeRows(
            startDate,
            endDate,
            status,
            fields,
          );
          const allArr = Array.isArray(all) ? all : [];
          const ids = Array.from(
            new Set(allArr.map((x) => x.employee_id).filter(Boolean)),
          );
          if (ids.length) {
            const placeholders = ids.map(() => "?").join(",");
            const [profRows] = await dbExecRaw(
              req,
              `SELECT employee_id, supervisor_id FROM employee_professional WHERE employee_id IN (${placeholders})`,
              ids,
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
            "[reportEmployeesHandler] fallback filtering failed:",
            e && e.message,
          );
          rows = [];
        }
      }
    } else {
      rows = await reportService.getEmployeeRows(
        startDate,
        endDate,
        status,
        fields,
      );
      rows = Array.isArray(rows) ? rows : [];
    }

    if (isPreviewRequest(req)) {
      console.debug(
        "[reportEmployeesHandler] preview rows:",
        rows.length,
        "status param:",
        status,
      );
      const msg =
        rows.length === 0
          ? "No employee data for selected date range"
          : undefined;
      return sendPreviewResponse(req, res, rows, msg);
    }

    if (!rows || rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No employee data for selected date range" });
    }

    const rowsToExport = pickFields(rows, fields);
    const meta = await buildMetaFromReqQuery(req.query || {});
    console.debug("[reportEmployeesHandler] PDF meta:", meta);

    if (format === "xlsx") {
      if (typeof reportService.renderExcelBuffer !== "function")
        return res
          .status(500)
          .json({ message: "Excel renderer not available" });
      const buf = await reportService.renderExcelBuffer(rowsToExport, null);
      const filename = safeFilename("employees_report", "xlsx");
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.setHeader("Content-Length", buf.length);
      return res.send(buf);
    } else if (format === "pdf") {
      if (typeof reportService.renderPdfBuffer !== "function")
        return res.status(500).json({ message: "PDF renderer not available" });
      const pdfBuf = await reportService.renderPdfBuffer(
        "Employees Report",
        rowsToExport,
        { meta },
      );
      const filename = safeFilename("employees_report", "pdf");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.setHeader("Content-Length", pdfBuf.length);
      return res.send(pdfBuf);
    } else {
      return res.status(400).json({ message: "Invalid format" });
    }
  } catch (err) {
    console.error(
      "[reportEmployeesHandler] Error rendering Employees report:",
      err && (err.stack || err.message),
    );
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = {
  downloadEmployeesReport,
};
