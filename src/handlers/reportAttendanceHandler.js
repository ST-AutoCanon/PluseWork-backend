const reportService = require("../services/reportIndex");
const {
  coerceToString,
  isPreviewRequest,
  sendPreviewResponse,
  safeFilename,
  parseDates,
  ensureTwoMonthWindow,
} = require("../services/reportFilters");

const db = require("../config");
const mysql = require("mysql2");

async function dbExec(sql, params = []) {
  try {
    if (!Array.isArray(params)) params = [params];
    params = params.map((p) => (typeof p === "undefined" ? null : p));

    if (db && typeof db.query === "function") {
      const maybePromise = db.query(sql, params);
      if (maybePromise && typeof maybePromise.then === "function") {
        const result = await maybePromise;
        if (Array.isArray(result)) return result;
        return [result, null];
      } else {
        return await new Promise((resolve, reject) => {
          db.query(sql, params, (err, rows, fields) => {
            if (err) return reject(err);
            resolve([rows, fields]);
          });
        });
      }
    }

    if (db && typeof db.execute === "function") {
      const maybePromise = db.execute(sql, params);
      if (maybePromise && typeof maybePromise.then === "function") {
        const result = await maybePromise;
        if (Array.isArray(result)) return result;
        return [result, null];
      } else {
        return await new Promise((resolve, reject) => {
          db.execute(sql, params, (err, rows, fields) => {
            if (err) return reject(err);
            resolve([rows, fields]);
          });
        });
      }
    }

    throw new Error("DB client has no execute/query method");
  } catch (e) {
    console.error(
      "[reportAttendanceHandler][dbExec] error:",
      e && (e.stack || e.message)
    );
    throw e;
  }
}

function findEmployeeIdInRequest(req) {
  const safe = (v) =>
    v === undefined || v === null ? null : String(v).trim() || null;

  const tryParseCandidate = (raw) => {
    if (raw === null || typeof raw === "undefined") return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (
      (s.startsWith("{") && s.endsWith("}")) ||
      (s.startsWith('"') && s.endsWith('"'))
    ) {
      try {
        const parsed = JSON.parse(s);
        if (parsed && typeof parsed === "object") {
          return (
            safe(parsed.employee_id) ||
            safe(parsed.employeeId) ||
            safe(parsed.id) ||
            safe(parsed.user_id) ||
            safe(parsed.email) ||
            null
          );
        }
      } catch (e) {}
    }
    return s;
  };

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
    if (candidate) {
      if (
        candidate &&
        (candidate.startsWith("{") || candidate.includes('"employeeId"'))
      ) {
        try {
          const p = JSON.parse(candidate);
          const extracted =
            safe(p.employee_id) ||
            safe(p.employeeId) ||
            safe(p.id) ||
            safe(p.user_id) ||
            safe(p.email) ||
            null;
          if (extracted) return extracted;
        } catch (e) {}
      }
      if (candidate && !candidate.startsWith("{")) return candidate;
    }
  }

  const r1 = req.employeeId ?? req.employee_id ?? req.userId ?? req.user_id;
  if (r1) {
    const candidate = tryParseCandidate(r1);
    if (candidate && !candidate.startsWith("{")) return candidate;
    if (candidate && candidate.startsWith("{")) {
      try {
        const p = JSON.parse(candidate);
        const extracted =
          safe(p.employee_id) ||
          safe(p.employeeId) ||
          safe(p.id) ||
          safe(p.user_id) ||
          safe(p.email) ||
          null;
        if (extracted) return extracted;
      } catch (e) {}
    }
  }

  const user = req.user || req.authUser || req.auth || req.session?.user;
  if (user && typeof user === "object") {
    const cand =
      safe(user.employee_id) ||
      safe(user.employeeId) ||
      safe(user.id) ||
      safe(user.user_id) ||
      safe(user.email);
    if (cand) return cand;
    const userStr = tryParseCandidate(user);
    if (userStr && !userStr.startsWith("{")) return userStr;
  }

  const auth = safe(req.headers && req.headers.authorization);
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token.split(".").length === 3) {
      try {
        const payloadRaw = Buffer.from(token.split(".")[1], "base64").toString(
          "utf8"
        );
        const payload = JSON.parse(payloadRaw);
        const candidate =
          safe(payload.employee_id) ||
          safe(payload.employeeId) ||
          safe(payload.sub) ||
          safe(payload.id) ||
          safe(payload.user_id) ||
          null;
        if (candidate) return candidate;
      } catch (e) {}
    }
  }

  const qCandidate =
    tryParseCandidate(
      req.query && (req.query.employee_id || req.query.employeeId)
    ) ||
    tryParseCandidate(
      req.body && (req.body.employee_id || req.body.employeeId)
    );
  if (qCandidate) return qCandidate;

  return null;
}

function filterAttendanceRows(rows, employeeId, departmentId) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  if (!employeeId && !departmentId) return rows;

  const empIdStr = employeeId ? String(employeeId).trim() : null;
  const deptIdRaw = departmentId ? String(departmentId).trim() : null;

  const deptFilterNum =
    deptIdRaw && /^-?\d+$/.test(deptIdRaw) ? Number(deptIdRaw) : null;
  const deptFilterName =
    deptFilterNum === null && deptIdRaw ? deptIdRaw.toLowerCase() : null;

  return rows.filter((r) => {
    const rowEmpId =
      r.employee_id != null ? String(r.employee_id).trim() : null;

    let rowDeptId = null;
    let rowDeptName = null;

    if (r.department_id != null) rowDeptId = Number(r.department_id);
    if (r.pr_department_id != null) rowDeptId = Number(r.pr_department_id);
    if (r.departmentId != null) rowDeptId = Number(r.departmentId);
    if (r.department_name != null)
      rowDeptName = String(r.department_name).toLowerCase();
    if (!rowDeptName && r.departmentName != null)
      rowDeptName = String(r.departmentName).toLowerCase();
    if (!rowDeptName && r.department != null)
      rowDeptName = String(r.department).toLowerCase();

    if (empIdStr && rowEmpId !== empIdStr) return false;

    if (deptFilterNum !== null) {
      if (rowDeptId == null) return false;
      if (Number(rowDeptId) !== Number(deptFilterNum)) return false;
      return true;
    } else if (deptFilterName !== null) {
      if (rowDeptName && rowDeptName === deptFilterName) return true;
      if (rowDeptId != null && String(rowDeptId) === deptIdRaw) return true;
      return false;
    }

    return true;
  });
}

async function fetchEmployeeProfessionalRowsByIds(dbExecFn, empIds = []) {
  if (!Array.isArray(empIds) || empIds.length === 0) return [];

  const columns = [
    "employee_id",
    "department_id",
    "domain",
    "employee_type",
    "role",
    "position",
    "supervisor_id",
    "salary",
    "resume_url",
    "joining_date",
  ];
  const selectCols = columns.join(", ");

  const placeholders = empIds.map(() => "?").join(",");

  const sql = `SELECT ${selectCols} FROM employee_professional WHERE employee_id IN (${placeholders})`;
  const [rows] = await dbExecFn(sql, empIds);
  return Array.isArray(rows) ? rows : [];
}

async function attachDeptInfoForRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;

  const empIds = Array.from(
    new Set(
      rows
        .map((r) => (r.employee_id != null ? String(r.employee_id) : null))
        .filter(Boolean)
    )
  );

  if (empIds.length === 0) return;

  const placeholders = empIds.map(() => "?").join(",");
  const sql = `SELECT employee_id, department_id FROM employee_professional WHERE employee_id IN (${placeholders})`;
  try {
    const [dbRows] = await dbExec(sql, empIds);
    const map = new Map();
    if (Array.isArray(dbRows)) {
      for (const dr of dbRows) {
        if (dr && dr.employee_id)
          map.set(String(dr.employee_id), dr.department_id);
      }
    }
    for (const r of rows) {
      const eid = r.employee_id != null ? String(r.employee_id) : null;
      if (eid && r.pr_department_id == null && r.department_id == null) {
        const did = map.get(eid);
        if (typeof did !== "undefined" && did !== null) {
          r.pr_department_id = did;
        }
      }
    }
  } catch (e) {
    console.warn(
      "[reportAttendanceHandler] attachDeptInfoForRows failed:",
      e && e.message
    );
  }
}

async function buildMetaFromReqQuery(query = {}) {
  const meta = {};
  const rawStatus =
    coerceToString(query.status, null) ||
    coerceToString(query.punch_status, null);
  if (rawStatus) {
    try {
      meta.status = rawStatus;
    } catch (e) {
      meta.status = rawStatus;
    }
  }

  const typedEmployeeName =
    coerceToString(query.employee_name, null) ||
    coerceToString(query.employeeName, null) ||
    coerceToString(query.employee, null);
  if (typedEmployeeName) {
    meta.employeeName = typedEmployeeName;
  } else {
    const empId =
      coerceToString(query.employee_id, null) ||
      coerceToString(query.employeeId, null);
    if (empId) meta.employeeName = empId;
  }

  let typedDept =
    coerceToString(query.department_name, null) ||
    coerceToString(query.departmentName, null) ||
    coerceToString(query.department, null);

  if (typedDept) {
    meta.department = typedDept;
  } else {
    const deptId =
      coerceToString(query.department_id, null) ||
      coerceToString(query.departmentId, null);

    if (deptId) {
      if (/^\d+$/.test(deptId)) {
        try {
          const [rows] = await dbExec(
            `SELECT id, department_name, departmentName, name FROM departments WHERE id = ? LIMIT 1`,
            [deptId]
          );
          if (Array.isArray(rows) && rows[0]) {
            const rec = rows[0];
            const name =
              coerceToString(rec.department_name, null) ||
              coerceToString(rec.departmentName, null) ||
              coerceToString(rec.name, null);
            if (name) meta.department = name;
            else meta.department = String(rec.id);
          } else {
            meta.department = deptId;
          }
        } catch (e) {
          console.warn(
            "[reportAttendanceHandler] lookup department name failed:",
            e && e.message
          );
          meta.department = deptId;
        }
      } else {
        meta.department = deptId;
      }
    }
  }

  return meta;
}

async function downloadAttendanceReport(req, res) {
  try {
    const parsed = parseDates(req.query || {});
    let { startDate, endDate, status, format, fields } = parsed;

    const employeeIdQuery = coerceToString(req.query.employee_id, null);
    let departmentIdQuery = coerceToString(req.query.department_id, null);

    const requesterEmpId = findEmployeeIdInRequest(req);
    if (requesterEmpId) {
      console.debug(
        "[reportAttendanceHandler] requester employee id discovered:",
        requesterEmpId
      );
    } else {
      console.debug(
        "[reportAttendanceHandler] no requester employee id discovered in request"
      );
    }

    if (!departmentIdQuery && requesterEmpId) {
      const derived = await (async (id) => {
        try {
          const [rows] = await dbExec(
            `SELECT department_id FROM employee_professional WHERE employee_id = ? LIMIT 1`,
            [id]
          );
          if (Array.isArray(rows) && rows[0] && rows[0].department_id != null)
            return String(rows[0].department_id);
        } catch (e) {
          console.warn(
            "[reportAttendanceHandler] lookupDeptForEmployee failed:",
            e && e.message
          );
        }
        return null;
      })(requesterEmpId);

      if (derived) {
        departmentIdQuery = derived;
        console.debug(
          "[reportAttendanceHandler] derived department for requester:",
          departmentIdQuery
        );
      } else {
        console.debug(
          "[reportAttendanceHandler] could not derive department for requester:",
          requesterEmpId
        );
      }
    } else if (departmentIdQuery) {
      console.debug(
        "[reportAttendanceHandler] using department_id from query:",
        departmentIdQuery
      );
    }

    const ensured = ensureTwoMonthWindow(startDate, endDate);
    if (!ensured.ok) return res.status(400).json({ message: ensured.message });
    startDate = ensured.startDate;
    endDate = ensured.endDate;

    if (typeof reportService.getAttendanceRows !== "function") {
      console.error(
        "[reportAttendanceHandler] reportService.getAttendanceRows missing"
      );
      return res.status(500).json({ message: "Server misconfiguration" });
    }

    let rows = await reportService.getAttendanceRows(
      startDate,
      endDate,
      status,
      fields,
      employeeIdQuery,
      null
    );

    rows = Array.isArray(rows) ? rows : [];

    console.debug("[reportAttendanceHandler] effective date window:", {
      startDate,
      endDate,
    });
    console.debug(
      "[reportAttendanceHandler] rows returned from service BEFORE filtering:",
      rows.length
    );
    if (rows.length > 0) {
      try {
        console.debug(
          "[reportAttendanceHandler] sample row:",
          JSON.stringify(rows[0])
        );
      } catch (e) {
        console.debug(
          "[reportAttendanceHandler] sample row (stringify failed):",
          rows[0]
        );
      }
    }

    const needLocalFiltering = Boolean(
      employeeIdQuery || departmentIdQuery || requesterEmpId
    );
    if (needLocalFiltering && rows.length > 0) {
      const anyHasDept = rows.some(
        (r) =>
          r.department_id != null ||
          r.pr_department_id != null ||
          r.departmentName != null ||
          r.department_name != null
      );

      if (!anyHasDept && departmentIdQuery) {
        await attachDeptInfoForRows(rows);
      }

      rows = filterAttendanceRows(
        rows,
        employeeIdQuery || null,
        departmentIdQuery || null
      );
      console.debug(
        "[reportAttendanceHandler] rows after local filtering:",
        rows.length
      );
    }

    if (isPreviewRequest(req)) {
      const msg =
        rows.length === 0
          ? "No attendance data for selected date range"
          : undefined;
      return sendPreviewResponse(req, res, rows, msg);
    }

    if (!Array.isArray(rows))
      return res
        .status(500)
        .json({ message: "Failed to fetch attendance data" });
    if (rows.length === 0)
      return res
        .status(404)
        .json({ message: "No attendance data for selected date range" });

    const meta = await buildMetaFromReqQuery(req.query || {});
    console.debug("[reportAttendanceHandler] render meta:", meta);

    if (format === "xlsx") {
      if (typeof reportService.renderExcelBuffer !== "function")
        return res
          .status(500)
          .json({ message: "Excel renderer not available" });

      const headers = [
        { header: "Punch ID", key: "punch_id" },
        { header: "Employee ID", key: "employee_id" },
        { header: "Employee Name", key: "employee_name" },
        { header: "Department", key: "department_name" },
        { header: "Status", key: "punch_status" },
        { header: "Punch In Time", key: "punchin_time" },
        { header: "Punch In Device", key: "punchin_device" },
        { header: "Punch In Location", key: "punchin_location" },
        { header: "Punch Out Time", key: "punchout_time" },
        { header: "Punch Out Device", key: "punchout_device" },
        { header: "Punch Out Location", key: "punchout_location" },
        { header: "Punch Mode", key: "punchmode" },
      ];

      const buf = await reportService.renderExcelBuffer(rows, headers);
      const filename = safeFilename("attendance_report", "xlsx");
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.setHeader("Content-Length", buf.length);
      return res.send(buf);
    }

    if (format === "pdf") {
      if (typeof reportService.renderPdfBuffer !== "function")
        return res.status(500).json({ message: "PDF renderer not available" });

      const buffer = await reportService.renderPdfBuffer(
        "Attendance Report",
        rows,
        { meta }
      );
      const filename = safeFilename("attendance_report", "pdf");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.setHeader("Content-Length", buffer.length);
      return res.send(buffer);
    }

    return res.status(400).json({ message: "Invalid format" });
  } catch (err) {
    console.error(
      "[reportAttendanceHandler] Error rendering Attendance report:",
      err && (err.stack || err)
    );
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = { downloadAttendanceReport };
