const queries = require("../constants/reportQueries");
const reportUtils = require("../services/reportUtils");
const { fetchRows, coerceToString } = reportUtils;

const reportService = require("../services/reportIndex");

const leavesHandler = require("./reportLeavesHandler");
const attendanceHandler = require("./reportAttendanceHandler");
const tasksHandler = require("./reportTasksHandler");
const assetsHandler = require("./reportAssetsHandler");
const reimbursementsHandler = require("./reportReimbursementsHandler");
const recruitmentHandler = require("./reportRecruitmentHandler");
const regularisationHandler = require("./reportRegularisationHandler");

async function deriveDepartmentForEmployee(employeeId) {
  try {
    if (!employeeId) {
      return null;
    }

    const raw = String(employeeId).trim();
    const candidatesSet = new Set();
    if (raw) candidatesSet.add(raw);
    const numericOnly = raw.replace(/\D/g, "");
    if (numericOnly) candidatesSet.add(numericOnly);
    const stsStripped = raw.replace(/^STS/i, "");
    if (stsStripped && stsStripped !== raw) candidatesSet.add(stsStripped);
    const candidates = Array.from(candidatesSet);

    const placeholders = (n) => (n > 0 ? Array(n).fill("?").join(", ") : "''");

    let rows = [];
    try {
      const sql1 = `
        SELECT department_id, role, position, supervisor_id
        FROM employee_professional
        WHERE employee_id IN (${placeholders(candidates.length)})
        LIMIT 1
      `;
      const params1 = [...candidates];
      rows = await fetchRows(sql1, params1);
    } catch (err) {
      console.warn(
        "[deriveDepartmentForEmployee] Try1 failed:",
        err && err.message,
      );
      rows = [];
    }

    if (!rows || !rows[0]) {
      try {
        const sql2 = `
          SELECT
            COALESCE(pr.department_id, e.department_id, e.dept_id) AS department_id,
            pr.role AS pr_role, pr.position AS pr_position,
            e.role AS e_role, e.position AS e_position, e.employee_code, e.employee_id AS emp_id
          FROM employees e
          LEFT JOIN employee_professional pr ON e.employee_id = pr.employee_id
          WHERE e.employee_code IN (${placeholders(candidates.length)})
             OR e.employee_id IN (${placeholders(candidates.length)})
          LIMIT 1
        `;
        const params2 = [...candidates, ...candidates];
        const r2 = await fetchRows(sql2, params2);

        if (Array.isArray(r2) && r2[0]) rows = r2;
      } catch (err2) {
        console.warn(
          "[deriveDepartmentForEmployee] Try2 failed:",
          err2 && err2.message,
        );
        rows = rows || [];
      }
    }

    if (!rows || !rows[0]) {
      try {
        const sql3 = `
          SELECT employee_id AS emp_id, employee_code, department AS department_col, dept_id
          FROM employees
          WHERE employee_id IN (${placeholders(
            candidates.length,
          )}) OR employee_code IN (${placeholders(candidates.length)})
          LIMIT 1
        `;
        const params3 = [...candidates, ...candidates];
        const r3 = await fetchRows(sql3, params3);

        if (Array.isArray(r3) && r3[0]) rows = r3;
      } catch (err3) {
        console.warn(
          "[deriveDepartmentForEmployee] Try3 failed:",
          err3 && err3.message,
        );
        rows = rows || [];
      }
    }

    if (!Array.isArray(rows) || !rows[0]) {
      return null;
    }

    const row = rows[0];

    const dept =
      row.department_id ??
      row.department_col ??
      row.dept_id ??
      (row.department_id === 0 ? 0 : undefined);
    const deptStr =
      dept === null || typeof dept === "undefined" ? null : String(dept);

    const roleCandidates = [
      row.role || row.pr_role || row.e_role || "",
      row.position || row.pr_position || row.e_position || "",
      row.designation || "",
    ]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase())
      .join(" ");

    const looksLikeManager =
      /(^|[^a-z])(manager|lead|supervisor|head|team ?lead)($|[^a-z])/.test(
        roleCandidates,
      );

    const hasSupervisorIdField = Object.prototype.hasOwnProperty.call(
      row,
      "supervisor_id",
    );
    const supervisorIdVal = hasSupervisorIdField ? row.supervisor_id : null;

    const isLikelyManager =
      looksLikeManager ||
      (hasSupervisorIdField &&
        (supervisorIdVal === null ||
          supervisorIdVal === 0 ||
          supervisorIdVal === "0"));

    if (isLikelyManager && deptStr) {
      return deptStr;
    }

    return null;
  } catch (e) {
    console.error(
      "[deriveDepartmentForEmployee] ERROR:",
      e && e.stack ? e.stack : e.message,
    );
    return null;
  } finally {
  }
}

function wrapHandlerWithDerivedDept(originalHandler) {
  if (typeof originalHandler !== "function") return originalHandler;
  return async function (req, res, next) {
    try {
      // Skip department derivation for admin/HR users - they should see all departments
      const user = req.user || req.authUser || req.session?.user;
      const userRole = user && (user.role || user.user_role);
      const lowerRole = userRole ? String(userRole).toLowerCase() : "";
      const isAdmin =
        lowerRole === "admin" ||
        lowerRole === "hr" ||
        lowerRole === "human resources";

      console.debug(
        "[wrapHandlerWithDerivedDept] userRole:",
        userRole,
        "lowerRole:",
        lowerRole,
        "isAdmin:",
        isAdmin,
      );

      if (isAdmin) {
        console.debug(
          "[reportsHandlerIndex] wrapHandlerWithDerivedDept: skipping department derivation for admin/HR user",
        );
        return originalHandler(req, res, next);
      }

      const hasDept =
        req.query &&
        (req.query.department_id ||
          req.query.departmentId ||
          req.query.department === 0 ||
          req.query.department === "0");
      if (!hasDept) {
        const headerEmp =
          (req.headers &&
            (req.headers["x-employee-id"] ||
              req.headers["x-employeeid"] ||
              req.headers["x-emp-id"] ||
              req.headers["x-employee"])) ||
          null;
        const empId = headerEmp ? String(headerEmp).trim() : null;

        const userEmp = (user && (user.employee_id || user.employeeId)) || null;
        const userEmpId = userEmp ? String(userEmp).trim() : null;

        const candidateEmpId = empId || userEmpId;

        console.debug(
          "[reportsHandlerIndex] wrapHandlerWithDerivedDept: header/x-user ids:",
          { headerEmp: empId, reqUserEmp: userEmpId },
        );

        if (candidateEmpId) {
          const derived = await deriveDepartmentForEmployee(candidateEmpId);
          console.debug(
            "[reportsHandlerIndex] wrapHandlerWithDerivedDept: derived dept:",
            derived,
          );
          if (derived) {
            if (!req.query) req.query = {};
            req.query.department_id = derived;
            req.query.departmentId = derived;
            req._derived_department_for_report = derived;
          }
        }
      }
    } catch (e) {
      console.warn(
        "[reportsHandlerIndex] wrapHandlerWithDerivedDept error:",
        e && e.message,
      );
    }
    try {
      return originalHandler(req, res, next);
    } catch (err) {
      console.error(
        "[reportsHandlerIndex] wrapped handler threw:",
        err && (err.stack || err.message),
      );
      if (!res.headersSent)
        return res.status(500).json({ message: "Internal Server Error" });
    }
  };
}

function parseFieldsParam(fieldsRaw) {
  if (!fieldsRaw) return null;
  if (Array.isArray(fieldsRaw)) {
    const arr = fieldsRaw.map((f) => String(f).trim()).filter(Boolean);
    return arr.length ? arr : null;
  }
  const s = String(fieldsRaw || "").trim();
  if (!s) return null;
  const parts = s.includes(",") ? s.split(",") : s.split(/\s+/);
  const arr = parts.map((p) => p.trim()).filter(Boolean);
  return arr.length ? arr : null;
}

async function searchEmployees(req, res) {
  try {
    const qParam =
      req.query && typeof req.query.q === "string" ? req.query.q.trim() : "";

    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit || "10", 10) || 10),
    );

    let dept =
      req.query && (req.query.department_id ?? req.query.departmentId)
        ? (req.query.department_id ?? req.query.departmentId)
        : null;

    if (typeof dept === "string") {
      const tr = dept.trim();
      if (!tr || tr.toLowerCase() === "null") dept = null;
    }

    const pattern = qParam.length ? `%${qParam}%` : `%`;

    const params = [pattern, pattern, pattern, dept, dept, limit];

    const rows = await fetchRows(queries.SEARCH_EMPLOYEES, params);
    if (rows?.length) return res.json(Array.isArray(rows) ? rows : []);
  } catch (e) {
    console.error("❌ [searchEmployees] Failed:", e && (e.stack || e.message));
    return res.status(500).json({ message: "Failed to search employees" });
  }
}

async function getDepartments(req, res) {
  try {
    const rows = await fetchRows(queries.GET_DEPARTMENTS, []);
    return res.json(Array.isArray(rows) ? rows : []);
  } catch (e) {
    console.error(
      "[reportsHandlerIndex] getDepartments failed:",
      e && (e.stack || e.message),
    );
    return res.status(500).json({ message: "Failed to fetch departments" });
  }
}

function normalizeStatusForQuery(statusRaw) {
  if (statusRaw === null || typeof statusRaw === "undefined") return null;
  const s = String(statusRaw).trim();
  if (!s) return null;
  if (s.toLowerCase() === "all") return null;
  return s;
}
async function downloadEmployeesReport(req, res) {
  try {
    const startDate = req.query.startDate ?? req.query.start_date ?? null;
    const endDate = req.query.endDate ?? req.query.end_date ?? null;

    let status = coerceToString(req.query.status ?? null, null);
    if (
      status &&
      typeof status === "string" &&
      status.trim().toLowerCase() === "all"
    ) {
      status = null;
    }

    let dept = coerceToString(
      req.query.department_id ?? req.query.departmentId ?? null,
      null,
    );
    if (dept && dept.toLowerCase && dept.toLowerCase() === "null") dept = null;

    let employee = coerceToString(
      req.query.employee_id ?? req.query.employee ?? null,
      null,
    );
    if (employee && employee.toLowerCase && employee.toLowerCase() === "null")
      employee = null;

    const params = [
      startDate,
      startDate,
      endDate,
      endDate,
      status,
      status,
      dept,
      dept,
      employee,
      employee,
    ];
    let rows;
    try {
      rows = await reportService.getEmployeeRows(
        startDate,
        endDate,
        status,
        null,
        employee,
        dept,
      );
    } catch (primaryErr) {
      console.error(
        "[reportsHandlerIndex] GET_EMPLOYEE_REPORT failed — will try compact fallback. Error:",
        primaryErr && (primaryErr.stack || primaryErr.message),
      );

      const compactQuery =
        queries.GET_EMPLOYEE_REPORT_COMPACT ||
        `
        SELECT
          e.employee_id,
          e.first_name,
          e.last_name,
          CONCAT(COALESCE(e.first_name,''), ' ', COALESCE(e.last_name,'')) AS employee_name,
          e.email,
          e.phone_number,
          e.status,
          COALESCE(pr.department_id, e.dept_id, e.department) AS department_id
        FROM employees e
        LEFT JOIN employee_professional pr ON e.employee_id = pr.employee_id
        WHERE ( ? IS NULL OR (e.created_at >= ? ) )
          AND ( ? IS NULL OR (e.created_at < DATE_ADD(?, INTERVAL 1 DAY) ) )
          AND ( ? IS NULL OR LOWER(e.status) = LOWER(?) )
          AND ( ? IS NULL OR COALESCE(pr.department_id, e.dept_id, e.department) = ? )
        ORDER BY e.created_at DESC
        `;

      // Use 8 params for fallback (excludes employee filter from SQL)
      const fallbackParams = [
        startDate,
        startDate,
        endDate,
        endDate,
        status,
        status,
        dept,
        dept,
      ];

      try {
        rows = await fetchRows(compactQuery, fallbackParams);
        rows = Array.isArray(rows) ? rows : [];
        // Apply employee filter in code for flexible matching
        if (employee) {
          rows = await filters.applyEmployeeAndDepartmentFilters(
            rows,
            employee,
            dept,
          );
        }
      } catch (fallbackErr) {
        console.error(
          "[reportsHandlerIndex] Compact fallback also failed:",
          fallbackErr && (fallbackErr.stack || fallbackErr.message),
        );
        return res.status(500).json({
          message:
            "SQL error while fetching employee report (see server logs).",
        });
      }
    }

    const rowsArr = Array.isArray(rows) ? rows : [];

    if (
      req.query &&
      (req.query.preview === "true" || req.query.preview === true)
    ) {
      return res.json(rowsArr);
    }

    const fields = parseFieldsParam(req.query.fields);
    let toExport = rowsArr;
    if (fields && typeof reportService.pickFields === "function") {
      try {
        toExport = reportService.pickFields(rowsArr, fields);
      } catch (e) {
        console.warn(
          "[reportsHandlerIndex] pickFields failed for employees:",
          e && e.message,
        );
      }
    }

    const format = String(req.query.format || "").toLowerCase();
    if (format === "xlsx") {
      if (typeof reportService.renderExcelBuffer !== "function")
        return res
          .status(500)
          .json({ message: "Excel renderer not available" });
      const buf = await reportService.renderExcelBuffer(toExport, null);
      const filename = "employees_report.xlsx";
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

      // Build metadata for PDF header
      const meta = {
        filters: [],
        status: null,
        employee: null,
        department: null,
      };

      if (startDate || endDate) {
        if (startDate && endDate) {
          meta.filters.push(`Date: ${startDate} → ${endDate}`);
        } else if (startDate) {
          meta.filters.push(`From: ${startDate}`);
        } else {
          meta.filters.push(`To: ${endDate}`);
        }
      }

      if (status && String(status).trim().toLowerCase() !== "all") {
        meta.status = String(status).trim();
        meta.filters.push(`Status: ${meta.status}`);
      }

      if (employee && String(employee).trim() !== "") {
        meta.employee = String(employee).trim();
        meta.filters.push(`Employee: ${meta.employee}`);
      }

      if (dept && String(dept).trim() !== "") {
        meta.department = String(dept).trim();
        meta.filters.push(`Department: ${meta.department}`);
      }

      const pdfBuf = await reportService.renderPdfBuffer(
        "Employees Report",
        toExport,
        { meta },
      );
      const filename = "employees_report.pdf";
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.setHeader("Content-Length", pdfBuf.length);
      console.log(
        `[reportsHandlerIndex] Generated PDF: ${pdfBuf.length} bytes for ${toExport.length} records`,
      );
      return res.send(pdfBuf);
    } else {
      return res.json(rowsArr);
    }
  } catch (e) {
    console.error(
      "[reportsHandlerIndex] downloadEmployeesReport failed:",
      e && (e.stack || e.message),
    );
    return res.status(500).json({ message: "Failed to fetch employee report" });
  }
}

async function downloadVendorsReport(req, res) {
  try {
    const startDate = req.query.startDate ?? req.query.start_date ?? null;
    const endDate = req.query.endDate ?? req.query.end_date ?? null;
    const params = [startDate, startDate, endDate, endDate];
    const rows = await fetchRows(queries.GET_VENDOR_REPORT, params);
    const rowsArr = Array.isArray(rows) ? rows : [];

    if (
      req.query &&
      (req.query.preview === "true" || req.query.preview === true)
    ) {
      return res.json(rowsArr);
    }

    const fields = parseFieldsParam(req.query.fields);
    let toExport = rowsArr;
    if (fields && typeof reportService.pickFields === "function") {
      try {
        toExport = reportService.pickFields(rowsArr, fields);
      } catch (e) {
        console.warn(
          "[reportsHandlerIndex] pickFields failed for vendors:",
          e && e.message,
        );
      }
    }

    const format = String(req.query.format || "").toLowerCase();
    if (format === "xlsx") {
      if (typeof reportService.renderExcelBuffer !== "function")
        return res
          .status(500)
          .json({ message: "Excel renderer not available" });
      const buf = await reportService.renderExcelBuffer(toExport, null);
      const filename = "vendors_report.xlsx";
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
        "Vendors Report",
        toExport,
        { meta: {} },
      );
      const filename = "vendors_report.pdf";
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.setHeader("Content-Length", pdfBuf.length);
      return res.send(pdfBuf);
    } else {
      return res.json(rowsArr);
    }
  } catch (e) {
    console.error(
      "[reportsHandlerIndex] downloadVendorsReport failed:",
      e && (e.stack || e.message),
    );
    return res.status(500).json({ message: "Failed to fetch vendors report" });
  }
}

function ensureExport(fn, fallbackName) {
  if (typeof fn === "function") return fn;
  return (req, res) => {
    console.error(`[reportsHandlerIndex] Handler "${fallbackName}" missing.`);
    return res
      .status(501)
      .json({ message: `${fallbackName} not implemented here.` });
  };
}

module.exports = {
  downloadAttendanceReport: wrapHandlerWithDerivedDept(
    ensureExport(
      attendanceHandler.downloadAttendanceReport,
      "downloadAttendanceReport",
    ),
  ),
  downloadLeavesReport: wrapHandlerWithDerivedDept(
    ensureExport(leavesHandler.downloadLeavesReport, "downloadLeavesReport"),
  ),
  downloadTasksSupervisorReport: wrapHandlerWithDerivedDept(
    ensureExport(
      tasksHandler.downloadTasksSupervisorReport,
      "downloadTasksSupervisorReport",
    ),
  ),
  downloadTasksEmployeeReport: wrapHandlerWithDerivedDept(
    ensureExport(
      tasksHandler.downloadTasksEmployeeReport,
      "downloadTasksEmployeeReport",
    ),
  ),
  downloadAssetsReport: ensureExport(
    assetsHandler.downloadAssetsReport,
    "downloadAssetsReport",
  ),
  downloadReimbursementsReport: wrapHandlerWithDerivedDept(
    ensureExport(
      reimbursementsHandler.downloadReimbursementsReport,
      "downloadReimbursementsReport",
    ),
  ),

  downloadRecruitmentReport: wrapHandlerWithDerivedDept(
    ensureExport(
      recruitmentHandler.downloadRecruitmentReport,
      "downloadRecruitmentReport",
    ),
  ),
  downloadRegularisationReport: wrapHandlerWithDerivedDept(
    ensureExport(
      regularisationHandler.downloadRegularisationReport,
      "downloadRegularisationReport",
    ),
  ),

  searchEmployees: wrapHandlerWithDerivedDept(searchEmployees),

  getDepartments,
  downloadEmployeesReport: wrapHandlerWithDerivedDept(downloadEmployeesReport),

  downloadVendorsReport,
};
