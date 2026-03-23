const reportService = require("../services/reportIndex");
const { fetchRows } = require("../services/reportUtils");
const {
  coerceToString,
  parseDates,
  ensureTwoMonthWindow,
  safeFilename,
  pickFields,
  normalizeStatusForQuery,
  statusMatches,
  isPreviewRequest,
  sendPreviewResponse,
} = require("../services/reportFilters");

function findEmployeeIdInRequest(req) {
  const safe = (v) =>
    v === undefined || v === null ? null : String(v).trim() || null;
  const headers = [
    "x-employee-id",
    "x-employeeid",
    "x-emp-id",
    "x-user-id",
    "x-user",
  ];
  for (const h of headers) {
    const v = safe(req.headers && req.headers[h]);
    if (v) return v;
  }
  const r1 = safe(
    req.employeeId ?? req.employee_id ?? req.userId ?? req.user_id,
  );
  if (r1) return r1;
  const user = req.user || req.authUser || req.auth || req.session?.user;
  if (user && typeof user === "object") {
    const cand =
      safe(user.employee_id) ||
      safe(user.employeeId) ||
      safe(user.id) ||
      safe(user.user_id) ||
      safe(user.email);
    if (cand) return cand;
  }
  const auth = safe(req.headers && req.headers.authorization);
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    try {
      if (token.split(".").length === 3) {
        const payload = JSON.parse(
          Buffer.from(token.split(".")[1], "base64").toString("utf8"),
        );
        const cand =
          safe(payload.employee_id) ||
          safe(payload.employeeId) ||
          safe(payload.sub) ||
          safe(payload.id);
        if (cand) return cand;
      }
    } catch (e) {}
  }
  const qCandidate =
    safe(req.query && (req.query.employee_id || req.query.employeeId)) ||
    safe(req.body && (req.body.employee_id || req.body.employeeId));
  if (qCandidate) return qCandidate;
  return null;
}

async function lookupDeptForEmployee(employeeId) {
  try {
    if (!employeeId) return null;
    const sql = `SELECT department_id FROM employee_professional WHERE employee_id = ? LIMIT 1`;
    const rows = await fetchRows(sql, [employeeId]);
    if (Array.isArray(rows) && rows[0] && rows[0].department_id != null)
      return String(rows[0].department_id);
  } catch (e) {
    console.warn(
      "[reportReimbursementsHandler] lookupDeptForEmployee failed:",
      e && e.message,
    );
  }
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
          "[reportReimbursementsHandler] query on manager_employee_id failed:",
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
          "[reportReimbursementsHandler] query on manager_id failed:",
          e && e.message,
        );
      }
    }
  } catch (e) {
    console.warn(
      "[reportReimbursementsHandler] SHOW COLUMNS failed:",
      e && e.message,
    );
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
      "[reportReimbursementsHandler] fallback department query failed:",
      e && e.message,
    );
  }

  return Array.from(new Set(out));
}

async function buildMetaFromReqQuery(query = {}) {
  const meta = {};
  const rawStatus =
    coerceToString(query.status, null) ||
    coerceToString(query.approval_status, null);
  if (rawStatus) {
    try {
      meta.status = normalizeStatusForQuery(rawStatus) || rawStatus;
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
    if (empId) {
      try {
        if (typeof reportService.searchEmployees === "function") {
          const found = await reportService.searchEmployees(empId);
          meta.employeeName =
            Array.isArray(found) && found[0]
              ? found[0].employee_name ||
                `${(found[0].first_name || "").trim()} ${(
                  found[0].last_name || ""
                ).trim()}`.trim() ||
                empId
              : empId;
        } else if (typeof reportService.getEmployeeRows === "function") {
          const er = await reportService.getEmployeeRows(empId);
          meta.employeeName =
            Array.isArray(er) && er[0]
              ? er[0].employee_name ||
                `${(er[0].first_name || "").trim()} ${(
                  er[0].last_name || ""
                ).trim()}`.trim() ||
                empId
              : empId;
        } else meta.employeeName = empId;
      } catch (e) {
        meta.employeeName = empId;
      }
    }
  }

  const typedDept =
    coerceToString(query.department_name, null) ||
    coerceToString(query.departmentName, null) ||
    coerceToString(query.department, null);
  if (typedDept) meta.department = typedDept;
  else {
    const deptId =
      coerceToString(query.department_id, null) ||
      coerceToString(query.departmentId, null);
    if (deptId) {
      try {
        if (typeof reportService.getDepartments === "function") {
          const depts = await reportService.getDepartments();
          if (Array.isArray(depts)) {
            const found = depts.find(
              (d) =>
                d &&
                (String(d.id) === String(deptId) ||
                  String(d.department_id || d.id) === String(deptId)),
            );
            meta.department =
              (found &&
                (found.name || found.department_name || found.department)) ||
              deptId;
          } else meta.department = deptId;
        } else meta.department = deptId;
      } catch (e) {
        meta.department = deptId;
      }
    }
  }

  return meta;
}

async function downloadReimbursementsReport(req, res) {
  const startTs = Date.now();
  try {
    const parsed = parseDates(req.query || {});
    let { startDate, endDate, status, format, fields } = parsed;

    let employeeId = coerceToString(req.query.employee_id, null);
    let departmentId = coerceToString(req.query.department_id, null);

    console.log("[reportReimbursementsHandler] Query params:", {
      employee_id: req.query.employee_id,
      employee: req.query.employee,
      department_id: req.query.department_id,
      employeeId,
      departmentId,
    });

    const requesterEmpId = findEmployeeIdInRequest(req);

    if (!departmentId && requesterEmpId) {
      const derived = await lookupDeptForEmployee(requesterEmpId);
      if (derived) {
        departmentId = derived;
        console.debug(
          "[reportReimbursementsHandler] derived department for requester:",
          departmentId,
        );
      }
    }

    let managerEmpId = null;
    if (!departmentId && requesterEmpId) {
      const u = req.user || req.authUser || req.session?.user;
      const isAdmin =
        !!(u && (u.is_admin || u.isAdmin || u.role === "admin")) || false;
      const isManagerRole = !!(
        u &&
        u.role &&
        /manager|supervisor|lead/i.test(String(u.role))
      );
      const explicitManager = String(
        (req.headers && req.headers["x-force-manager-scope"]) ||
          (req.query &&
            (req.query.forceManager ||
              req.query.manager_scope ||
              req.query.managerScope)) ||
          "",
      ).toLowerCase();
      const wantsMgrScope =
        explicitManager === "1" || explicitManager === "true" || isManagerRole;

      if (!isAdmin && wantsMgrScope) {
        managerEmpId = requesterEmpId;
        console.debug(
          "[reportReimbursementsHandler] manager scoping enabled for:",
          managerEmpId,
        );
      }
    }

    const ensured = ensureTwoMonthWindow(startDate, endDate);
    if (!ensured.ok) return res.status(400).json({ message: ensured.message });
    startDate = ensured.startDate;
    endDate = ensured.endDate;

    if (typeof reportService.getReimbursementRows !== "function") {
      console.error(
        "[reportReimbursementsHandler] reportService.getReimbursementRows missing",
      );
      return res.status(500).json({ message: "Server misconfiguration" });
    }

    if (employeeId || departmentId) {
      const rawReimbursements = await reportService.getReimbursementRows(
        startDate,
        endDate,
        status,
        null,
        employeeId,
        departmentId,
      );
      let rows = Array.isArray(rawReimbursements) ? rawReimbursements : [];

      if (departmentId) {
        rows = rows.filter((r) => {
          const rid =
            r &&
            (r.department_id ?? r.departmentId ?? r.department ?? r.dept_id);
          return rid != null && String(rid) === String(departmentId);
        });
      }
      if (employeeId) {
        rows = rows.filter((r) => {
          const eid =
            r && (r.employee_id ?? r.employeeId ?? r.emp_id ?? r.empId);
          return eid != null && String(eid) === String(employeeId);
        });
      }

      if (isPreviewRequest(req)) {
        const msg =
          rows.length === 0
            ? "No reimbursement data for selected date range"
            : undefined;
        return sendPreviewResponse(req, res, rows, msg);
      }

      // Status filtering already applied in service, skip additional filtering
      const filtered = rows;

      if (!filtered.length)
        return res
          .status(404)
          .json({ message: "No reimbursement data for selected date range" });

      const reimbursementsToExport = pickFields(filtered, fields);
      const meta = await buildMetaFromReqQuery(req.query || {});
      console.debug("[reportReimbursementsHandler] render meta:", meta);

      if (format === "xlsx") {
        if (typeof reportService.renderExcelBuffer !== "function")
          return res
            .status(500)
            .json({ message: "Excel renderer not available" });
        const buf = await reportService.renderExcelBuffer(
          reimbursementsToExport,
          null,
        );
        const filename = safeFilename("reimbursements_report", "xlsx");
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
          return res
            .status(500)
            .json({ message: "PDF renderer not available" });
        const pdfBuf = await reportService.renderPdfBuffer(
          "Reimbursements Report",
          reimbursementsToExport,
          { meta },
        );
        const filename = safeFilename("reimbursements_report", "pdf");
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`,
        );
        res.setHeader("Content-Length", pdfBuf.length);
        return res.send(pdfBuf);
      } else return res.status(400).json({ message: "Invalid format" });
    }

    let rows = [];
    if (managerEmpId) {
      let managedDeptIds = [];
      try {
        managedDeptIds = await findDepartmentsManagedBy(managerEmpId);
      } catch (e) {
        console.warn(
          "[reportReimbursementsHandler] findDepartmentsManagedBy attempt failed:",
          e && e.message,
        );
      }

      if (managedDeptIds.length > 0) {
        const merged = [];
        for (const d of managedDeptIds) {
          try {
            const part = await reportService.getReimbursementRows(
              startDate,
              endDate,
              status,
              null,
              null,
              d,
            );
            if (Array.isArray(part) && part.length) merged.push(...part);
          } catch (e) {
            console.warn(
              "[reportReimbursementsHandler] per-dept getReimbursementRows failed for dept",
              d,
              e && e.message,
            );
          }
        }
        const map = new Map();
        for (const p of merged)
          if (p && (p.reimbursement_id ?? p.id))
            map.set(String(p.reimbursement_id ?? p.id), p);
        rows = Array.from(map.values());
      } else {
        try {
          const all = await reportService.getReimbursementRows(
            startDate,
            endDate,
            status,
            null,
            null,
            null,
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
            "[reportReimbursementsHandler] fallback JS filtering failed:",
            e && e.message,
          );
          rows = [];
        }
      }
    } else {
      const rawReimbursements = await reportService.getReimbursementRows(
        startDate,
        endDate,
        status,
        null,
        null,
        null,
      );
      rows = Array.isArray(rawReimbursements) ? rawReimbursements : [];
    }

    const explicitDept = coerceToString(
      req.query && (req.query.department_id ?? req.query.departmentId),
      null,
    );
    const explicitEmp = coerceToString(
      req.query && (req.query.employee_id ?? req.query.employeeId),
      null,
    );
    if (explicitDept) {
      rows = rows.filter((r) => {
        const rid =
          r && (r.department_id ?? r.departmentId ?? r.department ?? r.dept_id);
        return rid != null && String(rid) === String(explicitDept);
      });
    }
    if (explicitEmp) {
      rows = rows.filter((r) => {
        const eid = r && (r.employee_id ?? r.employeeId ?? r.emp_id ?? r.empId);
        return eid != null && String(eid) === String(explicitEmp);
      });
    }

    if (isPreviewRequest(req)) {
      const msg =
        rows.length === 0
          ? "No reimbursement data for selected date range"
          : undefined;
      return sendPreviewResponse(req, res, rows, msg);
    }

    const statusCandidate = normalizeStatusForQuery(status);
    const filtered = rows.filter((r) =>
      statusMatches(statusCandidate, [
        r.status,
        r.payment_status,
        r.approval_status,
      ]),
    );

    if (filtered.length === 0)
      return res
        .status(404)
        .json({ message: "No reimbursement data for selected date range" });

    const reimbursementsToExport = pickFields(filtered, fields);
    const meta = await buildMetaFromReqQuery(req.query || {});
    console.debug("[reportReimbursementsHandler] render meta:", meta);

    if (format === "xlsx") {
      if (typeof reportService.renderExcelBuffer !== "function")
        return res
          .status(500)
          .json({ message: "Excel renderer not available" });
      const buf = await reportService.renderExcelBuffer(
        reimbursementsToExport,
        null,
      );
      const filename = safeFilename("reimbursements_report", "xlsx");
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
        "Reimbursements Report",
        reimbursementsToExport,
        { meta },
      );
      const filename = safeFilename("reimbursements_report", "pdf");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.setHeader("Content-Length", pdfBuf.length);
      return res.send(pdfBuf);
    } else return res.status(400).json({ message: "Invalid format" });
  } catch (err) {
    console.error(
      "[reportReimbursementsHandler] Error rendering Reimbursements report:",
      err && (err.stack || err),
    );
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    console.debug(
      "[reportReimbursementsHandler] finished in",
      Date.now() - startTs,
      "ms",
    );
  }
}

module.exports = { downloadReimbursementsReport };
