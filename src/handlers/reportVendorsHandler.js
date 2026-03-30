const reportService = require("../services/reportIndex");
const {
  parseDates,
  ensureTwoMonthWindow,
  safeFilename,
  coerceToString,
  isPreviewRequest,
  sendPreviewResponse,
} = require("../services/reportFilters");

async function buildMetaFromReqQuery(query = {}) {
  const meta = {};
  const rawStatus = coerceToString(query.status, null);
  if (rawStatus) {
    try {
      meta.status =
        typeof reportService.normalizeStatusForQuery === "function"
          ? reportService.normalizeStatusForQuery(rawStatus) || rawStatus
          : rawStatus;
    } catch (e) {
      meta.status = rawStatus;
    }
  }

  const typedEmployeeName =
    coerceToString(query.employee_name, null) ||
    coerceToString(query.employeeName, null) ||
    coerceToString(query.employee, null);
  const empId =
    coerceToString(query.employee_id, null) ||
    coerceToString(query.employeeId, null);

  if (empId) {
    // If we have an employee ID, look it up in the database to get proper formatting
    try {
      const rows = await reportService.fetchRows(
        `SELECT employee_id, first_name, last_name, email FROM employees WHERE employee_id = ? LIMIT 1`,
        [empId],
      );
      const er = Array.isArray(rows) && rows[0] ? rows[0] : null;
      if (er) {
        const fullName =
          `${(er.first_name || "").trim()} ${(
            er.last_name || ""
          ).trim()}`.trim() ||
          er.email ||
          er.employee_id;
        meta.employee = `${fullName} (${er.employee_id})`;
        meta.employeeName = fullName;
        meta.employeeId = er.employee_id;
      } else if (typedEmployeeName) {
        meta.employeeName = typedEmployeeName;
        meta.employeeId = empId;
      } else {
        meta.employeeName = empId;
        meta.employeeId = empId;
      }
    } catch (e) {
      // If lookup fails, use what we have
      if (typedEmployeeName) {
        meta.employeeName = typedEmployeeName;
        meta.employeeId = empId;
      } else {
        meta.employeeName = empId;
        meta.employeeId = empId;
      }
    }
  } else if (typedEmployeeName) {
    meta.employeeName = typedEmployeeName;
  }

  const typedDept =
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

async function downloadVendorsReport(req, res) {
  try {
    const parsed = parseDates(req.query || {});
    let { startDate, endDate, format, fields } = parsed;

    const employeeId = coerceToString(req.query.employee_id, null);
    const departmentId = coerceToString(req.query.department_id, null);

    const ensured = ensureTwoMonthWindow(startDate, endDate);
    if (!ensured.ok) return res.status(400).json({ message: ensured.message });
    startDate = ensured.startDate;
    endDate = ensured.endDate;

    if (typeof reportService.getVendorRows !== "function")
      return res.status(500).json({ message: "Server misconfiguration" });

    const rowsRaw = await reportService.getVendorRows(
      startDate,
      endDate,
      null,
      fields,
      employeeId,
      departmentId,
    );
    const rows = Array.isArray(rowsRaw) ? rowsRaw : [];

    if (isPreviewRequest(req)) {
      const msg =
        rows.length === 0
          ? "No vendor data for selected date range"
          : undefined;
      return sendPreviewResponse(req, res, rows, msg);
    }

    if (!Array.isArray(rowsRaw))
      return res.status(500).json({ message: "Failed to fetch vendor data" });
    if (rows.length === 0)
      return res
        .status(404)
        .json({ message: "No vendor data for selected date range" });

    let rowsForExport = rows;
    if (
      fields &&
      Array.isArray(fields) &&
      typeof reportService.pickFields === "function"
    ) {
      rowsForExport = reportService.pickFields(rows, fields);
    }

    const meta = await buildMetaFromReqQuery(req.query || {});
    console.debug("[ReportVendorsHandler] render meta:", meta);

    if (format === "xlsx") {
      if (typeof reportService.renderExcelBuffer !== "function")
        return res
          .status(500)
          .json({ message: "Excel renderer not available" });
      const buf = await reportService.renderExcelBuffer(rowsForExport, null);
      const filename = safeFilename("vendors_report", "xlsx");
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
        rowsForExport,
        { meta },
      );
      const filename = safeFilename("vendors_report", "pdf");
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
      "[ReportVendorsHandler] Error rendering Vendors report:",
      err && (err.stack || err),
    );
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = { downloadVendorsReport };
