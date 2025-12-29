const reportService = require("../services/reportIndex");
const reportUtils = require("../services/reportUtils");
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

const MAX_DOWNLOAD_FIELDS_TASKS = 13;

async function getEmployeeDepartment(employeeId) {
  if (!employeeId) return null;
  try {
    const rows = await reportUtils.fetchRows(
      "SELECT department_id FROM employee_professional WHERE employee_id = ? LIMIT 1",
      [String(employeeId)]
    );
    if (
      Array.isArray(rows) &&
      rows[0] &&
      typeof rows[0].department_id !== "undefined"
    )
      return rows[0].department_id != null
        ? String(rows[0].department_id).trim()
        : null;
    return null;
  } catch (e) {
    console.warn(
      "[reportTasksHandler] getEmployeeDepartment failed:",
      e && e.message
    );
    return null;
  }
}

async function verifyEmployeeInDepartment(employeeId, departmentId) {
  if (!employeeId) return false;
  if (!departmentId) return true;
  try {
    const mapped = await getEmployeeDepartment(employeeId);
    if (mapped === null) return false;
    return String(mapped).trim() === String(departmentId).trim();
  } catch (e) {
    console.warn(
      "[reportTasksHandler] verifyEmployeeInDepartment failed:",
      e && e.message
    );
    return false;
  }
}

async function resolveEmployeeIdsFromTypedName(typedName, departmentId) {
  if (!typedName || !typedName.trim()) return [];
  const q = String(typedName).trim();
  try {
    let items = [];
    if (typeof reportService.searchEmployees === "function") {
      const res = await reportService.searchEmployees({
        q,
        limit: 200,
        departmentId: departmentId || null,
      });
      if (Array.isArray(res)) items = res;
      else if (res && Array.isArray(res.results)) items = res.results;
      else if (res && Array.isArray(res.data)) items = res.data;
    } else {
      const pattern = `%${q}%`;
      const sql =
        "SELECT e.employee_id, pr.department_id FROM employees e LEFT JOIN employee_professional pr ON e.employee_id = pr.employee_id WHERE (CONCAT(COALESCE(e.first_name,''),' ',COALESCE(e.last_name,'')) LIKE ? OR e.email LIKE ? OR e.employee_id LIKE ?) LIMIT 200";
      const rows = await reportUtils.fetchRows(sql, [
        pattern,
        pattern,
        pattern,
      ]);
      if (Array.isArray(rows)) {
        items = rows.map((r) => ({
          employee_id: r.employee_id,
          department_id:
            r.department_id != null ? String(r.department_id).trim() : null,
        }));
      }
    }

    const normalized = (Array.isArray(items) ? items : [])
      .map((it) => {
        if (!it) return null;
        return {
          employee_id: it.employee_id || it.employeeId || it.id || null,
          department_id:
            it.department_id ||
            it.departmentId ||
            it.dept_id ||
            it.department ||
            null,
        };
      })
      .filter(Boolean);

    const uniqueIds = Array.from(
      new Set(normalized.map((i) => String(i.employee_id).trim()))
    );

    if (departmentId && uniqueIds.length > 0) {
      try {
        const placeholders = uniqueIds.map(() => "?").join(",");
        const profRows = await reportUtils.fetchRows(
          `SELECT employee_id, department_id FROM employee_professional WHERE employee_id IN (${placeholders})`,
          uniqueIds
        );
        const map = {};
        if (Array.isArray(profRows)) {
          for (const r of profRows) {
            if (r && r.employee_id != null) {
              map[String(r.employee_id).trim()] =
                r.department_id != null ? String(r.department_id).trim() : null;
            }
          }
        }
        const did = String(departmentId).trim();
        const filtered = uniqueIds.filter((eid) => {
          const m = map[eid];
          if (m == null || m === "") return false;
          return String(m).trim() === did;
        });
        return filtered;
      } catch (e) {
        const did = String(departmentId).trim();
        const fallbackFiltered = normalized
          .filter(
            (n) =>
              n.department_id != null && String(n.department_id).trim() === did
          )
          .map((n) => String(n.employee_id).trim());
        return Array.from(new Set(fallbackFiltered));
      }
    }

    return uniqueIds;
  } catch (e) {
    console.warn(
      "[reportTasksHandler] resolveEmployeeIdsFromTypedName failed:",
      e && e.message
    );
    return [];
  }
}

async function buildMetaFromReqQuery(query = {}) {
  const meta = {};

  const rawEmpStatus =
    coerceToString(query.emp_status, null) ||
    coerceToString(query.empStatus, null) ||
    coerceToString(query.status, null) ||
    coerceToString(query.task_status, null);

  if (rawEmpStatus) {
    try {
      const normalized = normalizeStatusForQuery(rawEmpStatus);
      meta.status = normalized || rawEmpStatus;
      meta.statusLabel = rawEmpStatus;
    } catch (e) {
      meta.status = rawEmpStatus;
      meta.statusLabel = rawEmpStatus;
    }
  }

  const typedEmployeeName =
    coerceToString(query.employee_name, null) ||
    coerceToString(query.employeeName, null) ||
    coerceToString(query.employee, null);
  if (typedEmployeeName) meta.employeeName = typedEmployeeName;
  else {
    const empId =
      coerceToString(query.employee_id, null) ||
      coerceToString(query.employeeId, null);
    if (empId) {
      try {
        if (typeof reportService.searchEmployees === "function") {
          const svcRes = await reportService.searchEmployees({
            q: empId,
            limit: 1,
          });
          let found = null;
          if (Array.isArray(svcRes) && svcRes.length) found = svcRes[0];
          else if (svcRes && Array.isArray(svcRes.results) && svcRes.results[0])
            found = svcRes.results[0];
          else if (svcRes && Array.isArray(svcRes.data) && svcRes.data[0])
            found = svcRes.data[0];
          meta.employeeName =
            (found &&
              (found.employee_name ||
                `${found.first_name || ""} ${found.last_name || ""}`.trim())) ||
            empId;
        } else {
          const er = await reportService.getEmployeeRows(empId);
          meta.employeeName =
            Array.isArray(er) && er[0] ? er[0].employee_name || empId : empId;
        }
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
                  String(d.department_id || d.departmentId || d.id) ===
                    String(deptId))
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

function rowMatchesStatusToken(statusToken, row) {
  if (!statusToken) return true;
  const candidateFields = [
    "status",
    "emp_status",
    "task_status",
    "sup_status",
    "sup_review_status",
    "empStatus",
    "taskStatus",
  ];
  const candidates = new Set();
  for (const k of candidateFields) {
    if (row && typeof row[k] !== "undefined" && row[k] !== null) {
      candidates.add(String(row[k]));
      try {
        const n = normalizeStatusForQuery(row[k]);
        if (n) candidates.add(n);
      } catch (e) {}
    }
  }
  const arr = Array.from(candidates);
  return statusMatches(statusToken, arr);
}

async function downloadTasksSupervisorReport(req, res) {
  try {
    const parsed = parseDates(req.query || {});
    let { startDate, endDate, status, format, fields } = parsed;
    const employeeId = coerceToString(req.query.employee_id, null);
    const departmentId = coerceToString(req.query.department_id, null);

    const ensured = ensureTwoMonthWindow(startDate, endDate);
    if (!ensured.ok) return res.status(400).json({ message: ensured.message });
    startDate = ensured.startDate;
    endDate = ensured.endDate;

    if (fields && fields.length > MAX_DOWNLOAD_FIELDS_TASKS) {
      return res.status(400).json({
        message: `Too many fields selected for download. Maximum allowed is ${MAX_DOWNLOAD_FIELDS_TASKS}.`,
      });
    }

    if (typeof reportService.getTaskRows !== "function")
      return res.status(500).json({ message: "Server misconfiguration" });

    if (employeeId && departmentId) {
      const ok = await verifyEmployeeInDepartment(employeeId, departmentId);
      if (!ok) {
        if (isPreviewRequest(req)) {
          return sendPreviewResponse(
            req,
            res,
            [],
            "No task data for selected date range"
          );
        } else {
          return res
            .status(404)
            .json({ message: "No task data for selected date range" });
        }
      }
    }

    const rawTasks = await reportService.getTaskRows(
      startDate,
      endDate,
      status,
      fields,
      employeeId,
      departmentId
    );
    let rows = Array.isArray(rawTasks) ? rawTasks : [];

    const typedEmployeeName =
      coerceToString(req.query.employee_name, null) ||
      coerceToString(req.query.employeeName, null) ||
      null;
    if (typedEmployeeName) {
      const resolvedIds = await resolveEmployeeIdsFromTypedName(
        typedEmployeeName,
        departmentId
      );
      if (!resolvedIds || resolvedIds.length === 0) {
        if (isPreviewRequest(req)) {
          return sendPreviewResponse(
            req,
            res,
            [],
            "No task data for selected date range"
          );
        } else {
          return res
            .status(404)
            .json({ message: "No task data for selected date range" });
        }
      }

      if (departmentId) {
        try {
          const placeholders = resolvedIds.map(() => "?").join(",");
          const profRows = await reportUtils.fetchRows(
            `SELECT employee_id FROM employee_professional WHERE employee_id IN (${placeholders}) AND department_id = ?`,
            [...resolvedIds, departmentId]
          );
          const verified = Array.isArray(profRows)
            ? profRows.map((r) => String(r.employee_id).trim())
            : [];
          if (!verified || verified.length === 0) {
            if (isPreviewRequest(req)) {
              return sendPreviewResponse(
                req,
                res,
                [],
                "No task data for selected date range"
              );
            } else {
              return res
                .status(404)
                .json({ message: "No task data for selected date range" });
            }
          }
          rows = rows.filter((r) => {
            const eid =
              r && (r.employee_id ?? r.employeeId ?? r.emp_id ?? r.empId);
            return eid != null && verified.includes(String(eid).trim());
          });
        } catch (e) {
          console.warn(
            "[reportTasksHandler] employee_professional lookup failed in supervisor filter:",
            e && e.message
          );
          if (isPreviewRequest(req)) {
            return sendPreviewResponse(
              req,
              res,
              [],
              "No task data for selected date range"
            );
          } else {
            return res
              .status(404)
              .json({ message: "No task data for selected date range" });
          }
        }
      } else {
        rows = rows.filter((r) => {
          const eid =
            r && (r.employee_id ?? r.employeeId ?? r.emp_id ?? r.empId);
          return eid != null && resolvedIds.includes(String(eid).trim());
        });
      }
    }

    if (departmentId && !typedEmployeeName) {
      const hasDeptIdField = rows.some(
        (r) =>
          Object.prototype.hasOwnProperty.call(r, "department_id") ||
          Object.prototype.hasOwnProperty.call(r, "departmentId") ||
          Object.prototype.hasOwnProperty.call(r, "dept_id") ||
          Object.prototype.hasOwnProperty.call(r, "department")
      );
      if (hasDeptIdField) {
        rows = rows.filter((r) => {
          const v =
            r.department_id ?? r.departmentId ?? r.dept_id ?? r.department;
          return v != null && String(v).trim() === String(departmentId).trim();
        });
      } else {
        const empIds = Array.from(
          new Set(
            rows
              .map((r) =>
                r && r.employee_id ? String(r.employee_id).trim() : null
              )
              .filter(Boolean)
          )
        );
        if (empIds.length > 0) {
          try {
            const placeholders = empIds.map(() => "?").join(",");
            const profRows = await reportUtils.fetchRows(
              `SELECT employee_id, department_id FROM employee_professional WHERE employee_id IN (${placeholders})`,
              empIds
            );
            const map = {};
            if (Array.isArray(profRows)) {
              for (const p of profRows) {
                if (p && p.employee_id != null)
                  map[String(p.employee_id).trim()] =
                    p.department_id != null
                      ? String(p.department_id).trim()
                      : null;
              }
            }
            rows = rows.filter((r) => {
              const eid =
                r && r.employee_id != null
                  ? String(r.employee_id).trim()
                  : null;
              if (!eid) return false;
              const mapped = map[eid];
              return (
                mapped != null &&
                String(mapped).trim() === String(departmentId).trim()
              );
            });
          } catch (e) {
            console.warn(
              "[reportTasksHandler] department mapping failed:",
              e && e.message
            );
            rows = [];
          }
        } else {
          rows = [];
        }
      }
    }

    if (employeeId) {
      rows = rows.filter((r) => {
        const eid = r && (r.employee_id ?? r.employeeId ?? r.emp_id ?? r.empId);
        return eid != null && String(eid).trim() === String(employeeId).trim();
      });
    }

    if (isPreviewRequest(req)) {
      const statusToken = normalizeStatusForQuery(status);
      const filteredPreview = rows.filter((t) =>
        rowMatchesStatusToken(statusToken, t)
      );
      const msg =
        filteredPreview.length === 0
          ? "No task data for selected date range"
          : undefined;
      return sendPreviewResponse(req, res, filteredPreview, msg);
    }

    const statusTokenFinal = normalizeStatusForQuery(status);
    const filtered = rows.filter((t) =>
      rowMatchesStatusToken(statusTokenFinal, t)
    );
    if (filtered.length === 0)
      return res
        .status(404)
        .json({ message: "No task data for selected date range" });

    const tasksForExcel = pickFields(filtered, fields);
    const tasksForPdf = filtered;
    const meta = await buildMetaFromReqQuery(req.query || {});

    if (format === "xlsx") {
      const buf =
        typeof reportService.renderTasksExcelBuffer === "function"
          ? await reportService.renderTasksExcelBuffer(tasksForExcel, [])
          : await reportService.renderExcelBuffer(tasksForExcel, null);
      const filename = safeFilename("tasks_supervisor_report", "xlsx");
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
    } else if (format === "pdf") {
      let pdfBuf;
      try {
        pdfBuf = await reportService.renderPdfBuffer(
          "Tasks (Supervisor) Report",
          tasksForPdf,
          { meta }
        );
      } catch (e) {
        console.error(
          "[reportTasksHandler] renderPdfBuffer failed for supervisor tasks:",
          e && (e.stack || e)
        );
        return res.status(500).json({ message: "Failed to render PDF" });
      }
      if (!pdfBuf || !Buffer.isBuffer(pdfBuf) || pdfBuf.length === 0) {
        console.error(
          "[reportTasksHandler] renderPdfBuffer returned empty buffer for supervisor tasks."
        );
        return res
          .status(500)
          .json({ message: "Failed to render PDF (empty)" });
      }
      const filename = safeFilename("tasks_supervisor_report", "pdf");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.setHeader("Content-Length", pdfBuf.length);
      return res.send(pdfBuf);
    } else return res.status(400).json({ message: "Invalid format" });
  } catch (err) {
    console.error(
      "[reportTasksHandler] Error rendering Tasks (Supervisor) report:",
      err && (err.stack || err)
    );
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

async function downloadTasksEmployeeReport(req, res) {
  try {
    const parsed = parseDates(req.query || {});
    let { startDate, endDate, status: parsedStatus, format, fields } = parsed;

    const rawEmpStatus =
      coerceToString(req.query.emp_status, null) ||
      coerceToString(req.query.empStatus, null) ||
      coerceToString(parsedStatus, null) ||
      null;
    const normalizedEmpStatus = normalizeStatusForQuery(rawEmpStatus);

    const employeeId = coerceToString(req.query.employee_id, null);
    const departmentId = coerceToString(req.query.department_id, null);

    const ensured = ensureTwoMonthWindow(startDate, endDate);
    if (!ensured.ok) return res.status(400).json({ message: ensured.message });
    startDate = ensured.startDate;
    endDate = ensured.endDate;

    const isPreview = isPreviewRequest(req);
    if (!isPreview && fields && fields.length > MAX_DOWNLOAD_FIELDS_TASKS) {
      return res.status(400).json({
        message: `Too many fields selected for download. Maximum allowed is ${MAX_DOWNLOAD_FIELDS_TASKS}.`,
      });
    }

    if (typeof reportService.getWeeklyTaskRows !== "function")
      return res.status(500).json({ message: "Server misconfiguration" });

    if (employeeId && departmentId) {
      const ok = await verifyEmployeeInDepartment(employeeId, departmentId);
      if (!ok) {
        if (isPreview)
          return sendPreviewResponse(
            req,
            res,
            [],
            "No weekly task data for selected date range"
          );
        else
          return res
            .status(404)
            .json({ message: "No weekly task data for selected date range" });
      }
    }

    let rawWeekly;
    try {
      rawWeekly = await reportService.getWeeklyTaskRows(
        startDate,
        endDate,
        parsedStatus,
        fields,
        employeeId,
        departmentId
      );
    } catch (e) {
      console.error(
        "[reportTasksHandler] getWeeklyTaskRows failed:",
        e && (e.stack || e.message)
      );
      const msg =
        e && e.message && typeof e.message === "string"
          ? `Service error: ${e.message}`
          : "Failed to fetch weekly task rows";
      return res.status(500).json({ message: msg });
    }

    let rows = Array.isArray(rawWeekly) ? rawWeekly : [];

    const typedEmployeeName =
      coerceToString(req.query.employee_name, null) ||
      coerceToString(req.query.employeeName, null) ||
      null;
    if (typedEmployeeName) {
      const resolvedIds = await resolveEmployeeIdsFromTypedName(
        typedEmployeeName,
        departmentId
      );
      if (!resolvedIds || resolvedIds.length === 0) {
        if (isPreview)
          return sendPreviewResponse(
            req,
            res,
            [],
            "No weekly task data for selected date range"
          );
        else
          return res
            .status(404)
            .json({ message: "No weekly task data for selected date range" });
      }

      if (departmentId) {
        try {
          const placeholders = resolvedIds.map(() => "?").join(",");
          const profRows = await reportUtils.fetchRows(
            `SELECT employee_id FROM employee_professional WHERE employee_id IN (${placeholders}) AND department_id = ?`,
            [...resolvedIds, departmentId]
          );
          const verified = Array.isArray(profRows)
            ? profRows.map((r) => String(r.employee_id).trim())
            : [];
          if (!verified || verified.length === 0) {
            if (isPreview)
              return sendPreviewResponse(
                req,
                res,
                [],
                "No weekly task data for selected date range"
              );
            else
              return res.status(404).json({
                message: "No weekly task data for selected date range",
              });
          }
          rows = rows.filter((r) => {
            const eid =
              r && (r.employee_id ?? r.employeeId ?? r.emp_id ?? r.empId);
            return eid != null && verified.includes(String(eid).trim());
          });
        } catch (e) {
          console.warn(
            "[reportTasksHandler] employee_professional lookup failed in employee-driven filter:",
            e && e.message
          );
          if (isPreview)
            return sendPreviewResponse(
              req,
              res,
              [],
              "No weekly task data for selected date range"
            );
          else
            return res
              .status(404)
              .json({ message: "No weekly task data for selected date range" });
        }
      } else {
        rows = rows.filter((r) => {
          const eid =
            r && (r.employee_id ?? r.employeeId ?? r.emp_id ?? r.empId);
          return eid != null && resolvedIds.includes(String(eid).trim());
        });
      }
    }

    if (departmentId && !typedEmployeeName) {
      const hasDeptIdField = rows.some(
        (r) =>
          Object.prototype.hasOwnProperty.call(r, "department_id") ||
          Object.prototype.hasOwnProperty.call(r, "departmentId") ||
          Object.prototype.hasOwnProperty.call(r, "dept_id") ||
          Object.prototype.hasOwnProperty.call(r, "department")
      );
      if (hasDeptIdField) {
        rows = rows.filter((r) => {
          const v =
            r.department_id ?? r.departmentId ?? r.dept_id ?? r.department;
          return v != null && String(v).trim() === String(departmentId).trim();
        });
      } else {
        const empIds = Array.from(
          new Set(
            rows
              .map((r) =>
                r && r.employee_id ? String(r.employee_id).trim() : null
              )
              .filter(Boolean)
          )
        );
        if (empIds.length > 0) {
          try {
            const placeholders = empIds.map(() => "?").join(",");
            const profRows = await reportUtils.fetchRows(
              `SELECT employee_id, department_id FROM employee_professional WHERE employee_id IN (${placeholders})`,
              empIds
            );
            const map = {};
            if (Array.isArray(profRows)) {
              for (const p of profRows) {
                if (p && p.employee_id != null)
                  map[String(p.employee_id).trim()] =
                    p.department_id != null
                      ? String(p.department_id).trim()
                      : null;
              }
            }
            rows = rows.filter((r) => {
              const eid =
                r && r.employee_id != null
                  ? String(r.employee_id).trim()
                  : null;
              if (!eid) return false;
              const mapped = map[eid];
              return (
                mapped != null &&
                String(mapped).trim() === String(departmentId).trim()
              );
            });
          } catch (e) {
            console.warn(
              "[reportTasksHandler] department mapping failed:",
              e && e.message
            );
            rows = [];
          }
        } else {
          rows = [];
        }
      }
    }

    if (employeeId) {
      rows = rows.filter((r) => {
        const eid = r && (r.employee_id ?? r.employeeId ?? r.emp_id ?? r.empId);
        return eid != null && String(eid).trim() === String(employeeId).trim();
      });
    }

    const filtered = rows.filter((w) =>
      statusMatches(normalizedEmpStatus, [w && w.emp_status])
    );

    if (isPreview) {
      const msg =
        filtered.length === 0
          ? "No weekly task data for selected date range"
          : undefined;
      return sendPreviewResponse(req, res, filtered, msg);
    }

    if (filtered.length === 0)
      return res
        .status(404)
        .json({ message: "No weekly task data for selected date range" });

    const weeklyForExcel = pickFields(filtered, fields);
    const weeklyForPdf = filtered;
    const meta = await buildMetaFromReqQuery(req.query || {});
    if (normalizedEmpStatus) meta.status = normalizedEmpStatus;
    if (rawEmpStatus && !meta.statusLabel) meta.statusLabel = rawEmpStatus;

    if (format === "xlsx") {
      const buf =
        typeof reportService.renderTasksExcelBuffer === "function"
          ? await reportService.renderTasksExcelBuffer([], weeklyForExcel)
          : await reportService.renderExcelBuffer(weeklyForExcel, null);
      const filename = safeFilename("tasks_employee_report", "xlsx");
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
    } else if (format === "pdf") {
      let pdfBuf;
      try {
        pdfBuf = await reportService.renderPdfBuffer(
          "Tasks (Employee) Report",
          weeklyForPdf,
          { meta }
        );
      } catch (e) {
        console.error(
          "[reportTasksHandler] renderPdfBuffer failed for employee tasks:",
          e && (e.stack || e)
        );
        return res.status(500).json({ message: "Failed to render PDF" });
      }
      if (!pdfBuf || !Buffer.isBuffer(pdfBuf) || pdfBuf.length === 0) {
        console.error(
          "[reportTasksHandler] renderPdfBuffer returned empty buffer for employee tasks."
        );
        return res
          .status(500)
          .json({ message: "Failed to render PDF (empty)" });
      }
      const filename = safeFilename("tasks_employee_report", "pdf");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.setHeader("Content-Length", pdfBuf.length);
      return res.send(pdfBuf);
    } else return res.status(400).json({ message: "Invalid format" });
  } catch (err) {
    console.error(
      "[reportTasksHandler] Error rendering Tasks (Employee) report:",
      err && (err.stack || err)
    );
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = { downloadTasksSupervisorReport, downloadTasksEmployeeReport };
