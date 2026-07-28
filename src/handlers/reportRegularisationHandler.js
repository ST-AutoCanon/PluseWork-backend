const reportService = require("../services/reportIndex");
const {
  parseDates,
  ensureTwoMonthWindow,
  isPreviewRequest,
  sendPreviewResponse,
  safeFilename,
  coerceToString,
} = require("../services/reportFilters");

function buildMetaFromReqQuery(query = {}) {
  const meta = {};
  const rawStatus = coerceToString(query.status, null);
  if (rawStatus) {
    meta.status = rawStatus;
    meta.filters = meta.filters || [];
    meta.filters.push(`Status: ${rawStatus}`);
  }

  const employee = coerceToString(
    query.employee ?? query.employee_id ?? query.employeeId,
    null,
  );
  if (employee) {
    meta.employee = employee;
    meta.filters = meta.filters || [];
    meta.filters.push(`Employee: ${employee}`);
  }

  const department = coerceToString(
    query.department_id ?? query.departmentId ?? query.department,
    null,
  );
  if (department) {
    meta.department = department;
    meta.filters = meta.filters || [];
    meta.filters.push(`Department: ${department}`);
  }

  if (Array.isArray(meta.filters) && meta.filters.length > 0) {
    meta.summary = meta.filters.join(" | ");
  }
  return meta;
}

async function downloadRegularisationReport(req, res) {
  try {
    const parsed = parseDates(req.query || {});
    let { startDate, endDate, status, format, fields } = parsed;

    const employeeId = coerceToString(
      req.query?.employee_id ?? req.query?.employeeId ?? req.query?.employee,
      null,
    );
    const departmentId = coerceToString(
      req.query?.department_id ??
        req.query?.departmentId ??
        req.query?.department,
      null,
    );

    const ensured = ensureTwoMonthWindow(startDate, endDate);
    if (!ensured.ok) {
      return res.status(400).json({ message: ensured.message });
    }

    startDate = ensured.startDate;
    endDate = ensured.endDate;

    if (typeof reportService.getRegularisationRows !== "function") {
      return res.status(500).json({ message: "Server misconfiguration" });
    }

    const rows = await reportService.getRegularisationRows(
      startDate,
      endDate,
      status,
      fields,
      employeeId,
      departmentId,
    );

    if (isPreviewRequest(req)) {
      const msg =
        rows.length === 0
          ? "No attendance regularisation data for selected date range"
          : undefined;
      return sendPreviewResponse(req, res, rows, msg);
    }

    if (!Array.isArray(rows)) {
      return res
        .status(500)
        .json({ message: "Failed to fetch attendance regularisation data" });
    }

    if (rows.length === 0) {
      return res.status(404).json({
        message: "No attendance regularisation data for selected date range",
      });
    }

    let rowsForExport = rows;
    if (
      fields &&
      Array.isArray(fields) &&
      typeof reportService.pickFields === "function"
    ) {
      rowsForExport = reportService.pickFields(rows, fields);
    }

    const meta = buildMetaFromReqQuery(req.query || {});

    if (format === "xlsx") {
      if (typeof reportService.renderExcelBuffer !== "function") {
        return res
          .status(500)
          .json({ message: "Excel renderer not available" });
      }
      const buf = await reportService.renderExcelBuffer(rowsForExport, null);
      const filename = safeFilename("attendance_regularisation_report", "xlsx");
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
    }

    if (format === "pdf") {
      if (typeof reportService.renderPdfBuffer !== "function") {
        return res.status(500).json({ message: "PDF renderer not available" });
      }
      const pdfBuf = await reportService.renderPdfBuffer(
        "Attendance Regularisation Report",
        rowsForExport,
        { meta },
      );
      const filename = safeFilename("attendance_regularisation_report", "pdf");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.setHeader("Content-Length", pdfBuf.length);
      return res.send(pdfBuf);
    }

    return res.status(400).json({ message: "Invalid format" });
  } catch (err) {
    console.error(
      "[reportRegularisationHandler] Error rendering attendance regularisation report:",
      err && (err.stack || err),
    );
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = { downloadRegularisationReport };
