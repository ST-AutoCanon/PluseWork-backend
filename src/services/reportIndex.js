const utils = require("./reportUtils");
const filters = require("./reportFilters");
const reports = require("./reports");
const renders = require("./reportRenders");
const reportMeta = require("./reportMeta");

const queries = require("../constants/reportQueries");

function withDefaultOptions(opts) {
  return opts && typeof opts === "object" ? opts : {};
}

async function resolveDepartmentName(deptValue) {
  if (!deptValue) return deptValue;
  const str = String(deptValue).trim();
  if (!str || isNaN(str)) return deptValue;
  try {
    const rows = await utils.fetchRows(queries.GET_DEPARTMENT_NAME_BY_ID, [
      str,
    ]);
    if (rows && rows[0] && rows[0].name) return rows[0].name;
  } catch (e) {
    console.warn("[reportIndex] resolveDepartmentName failed:", e.message);
  }
  return deptValue;
}

function normalizeMetaForRender(raw) {
  const out = {};

  if (!raw || typeof raw !== "object") return out;

  const source =
    raw.meta && typeof raw.meta === "object"
      ? raw.meta
      : raw.query && typeof raw.query === "object"
        ? raw.query
        : raw.req && raw.req.query && typeof raw.req.query === "object"
          ? raw.req.query
          : raw;

  const norm = (v) => {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s.length ? s : null;
  };

  const statusCandidate =
    norm(source.status) ||
    norm(source.approval_status) ||
    norm(source.payment_status) ||
    norm(source.state) ||
    null;
  if (statusCandidate) out.status = statusCandidate;

  const deptNameCandidate =
    norm(source.departmentName) ||
    norm(source.department) ||
    norm(source.department_name) ||
    norm(source.department_name_display) ||
    null;
  if (deptNameCandidate) {
    out.department = deptNameCandidate;
  } else {
    const deptIdCandidate =
      norm(source.departmentId) || norm(source.department_id);
    if (deptIdCandidate) out.department = deptIdCandidate;
  }

  const empNameCandidate =
    norm(source.employeeName) ||
    norm(source.employee_name) ||
    norm(source.employee) ||
    null;
  if (empNameCandidate) {
    out.employeeName = empNameCandidate;
  } else {
    const empIdCandidate = norm(source.employeeId) || norm(source.employee_id);
    if (empIdCandidate) out.employeeName = empIdCandidate;
  }

  return out;
}

function inferComponentFromTitle(title) {
  if (!title || typeof title !== "string") return null;
  const t = title.toLowerCase();
  if (t.includes("employee")) return "employees";
  if (t.includes("leave")) return "leaves";
  if (t.includes("reimburse") || t.includes("claim")) return "reimbursements";
  if (t.includes("attendance") || t.includes("punch")) return "attendance";
  if (t.includes("task") && t.includes("weekly")) return "weekly_tasks";
  if (t.includes("task")) return "tasks";
  if (t.includes("vendor")) return "vendors";
  if (t.includes("asset")) return "assets";
  return null;
}

function attachFieldDisplayMapToMeta(meta, options = {}) {
  const outMeta = Object.assign({}, meta || {});
  try {
    const component =
      (options && options.component) ||
      inferComponentFromTitle(options && options.title);
    if (component && typeof reports.getFieldDisplayNames === "function") {
      const map = reports.getFieldDisplayNames(component);
      if (map && typeof map === "object" && Object.keys(map).length > 0) {
        outMeta._field_display_map = map;
      }
    }
  } catch (e) {
    console.warn(
      "[reportIndex] attachFieldDisplayMapToMeta failed:",
      e && e.message,
    );
  }
  return outMeta;
}

module.exports = {
  fetchRows: utils.fetchRows,
  coerceToString: utils.coerceToString,

  normalizeStatusForQuery: filters.normalizeStatusForQuery,
  buildDateStatusParams: filters.buildDateStatusParams,
  keepOnlyFields: filters.keepOnlyFields,
  normalizeReimbursementRow: filters.normalizeReimbursementRow,
  applyEmployeeAndDepartmentFilters: filters.applyEmployeeAndDepartmentFilters,
  normalizeForCompare: filters.normalizeForCompare,
  statusMatches: filters.statusMatches,
  pickFields: filters.pickFields,

  getLeaveRows: reports.getLeaveRows,
  getReimbursementRows: reports.getReimbursementRows,
  getEmployeeRows: reports.getEmployeeRows,
  getVendorRows: reports.getVendorRows,
  getAssetRows: reports.getAssetRows,
  getAttendanceRows: reports.getAttendanceRows,
  getTaskRows: reports.getTaskRows,
  getWeeklyTaskRows: reports.getWeeklyTaskRows,
  getDepartments: reports.getDepartments,
  searchEmployees: reports.searchEmployees,
  getFieldDisplayNames: reports.getFieldDisplayNames,

  renderExcelBuffer: renders.renderExcelBuffer,
  renderTasksExcelBuffer: renders.renderTasksExcelBuffer,

  renderPdfBuffer: async (title, rows, options) => {
    const opts = withDefaultOptions(options);
    const meta = normalizeMetaForRender(opts);

    if (
      !meta.status &&
      !meta.department &&
      !meta.employeeName &&
      opts.req &&
      opts.req.query
    ) {
      const metaFromReq = normalizeMetaForRender({ query: opts.req.query });
      if (
        metaFromReq.status ||
        metaFromReq.department ||
        metaFromReq.employeeName
      ) {
        Object.assign(meta, metaFromReq);
      }
    }
    if (!meta.status && !meta.department && !meta.employeeName) {
      const metaFromTop = normalizeMetaForRender(opts);
      if (
        metaFromTop.status ||
        metaFromTop.department ||
        metaFromTop.employeeName
      ) {
        Object.assign(meta, metaFromTop);
      }
    }

    const metaWithMap = attachFieldDisplayMapToMeta(meta, {
      component: opts.component,
      title,
    });

    if (metaWithMap.department) {
      metaWithMap.department = await resolveDepartmentName(
        metaWithMap.department,
      );
    }

    if (
      !metaWithMap.status &&
      !metaWithMap.department &&
      !metaWithMap.employeeName
    ) {
      try {
        console.debug(
          "[reportIndex] renderPdfBuffer called without meta or query-derived filters.",
        );
      } catch (e) {}
    }

    return await renders.renderPdfBuffer(title, rows, metaWithMap);
  },

  renderExcelToPdfBuffer: async (rows, headers, options) => {
    const opts = withDefaultOptions(options);
    const meta = normalizeMetaForRender(opts);
    if (
      !meta.status &&
      !meta.department &&
      !meta.employeeName &&
      opts.req &&
      opts.req.query
    ) {
      Object.assign(meta, normalizeMetaForRender({ query: opts.req.query }));
    }
    const metaWithMap = attachFieldDisplayMapToMeta(meta, {
      component: opts.component,
      title: opts.title,
    });
    return await renders.renderExcelToPdfBuffer(
      rows,
      headers,
      opts.title,
      metaWithMap,
    );
  },

  renderHtmlStringToPdfBuffer: renders.renderHtmlStringToPdfBuffer,

  renderXlsxBufferToPdfBuffer: async (xlsxBuffer, options) => {
    const opts = withDefaultOptions(options);
    const meta = normalizeMetaForRender(opts);
    if (
      !meta.status &&
      !meta.department &&
      !meta.employeeName &&
      opts.req &&
      opts.req.query
    ) {
      Object.assign(meta, normalizeMetaForRender({ query: opts.req.query }));
    }
    const metaWithMap = attachFieldDisplayMapToMeta(meta, {
      component: opts.component,
      title: opts.title,
    });
    return await renders.renderXlsxBufferToPdfBuffer(
      xlsxBuffer,
      opts.title,
      metaWithMap,
    );
  },

  renderTasksPdfBuffer: async (tasksRows, weeklyRows, options) => {
    const opts = withDefaultOptions(options);
    const meta = normalizeMetaForRender(opts);
    if (
      !meta.status &&
      !meta.department &&
      !meta.employeeName &&
      opts.req &&
      opts.req.query
    ) {
      Object.assign(meta, normalizeMetaForRender({ query: opts.req.query }));
    }
    const metaWithMap = attachFieldDisplayMapToMeta(meta, {
      component: opts.component || "weekly_tasks",
      title: opts.title || "Tasks",
    });
    return await renders.renderTasksPdfBuffer(
      tasksRows,
      weeklyRows,
      metaWithMap,
    );
  },

  renderTasksPdfBufferUsingHtml: async (tasksRows, weeklyRows, options) => {
    const opts = withDefaultOptions(options);
    const meta = normalizeMetaForRender(opts);
    if (
      !meta.status &&
      !meta.department &&
      !meta.employeeName &&
      opts.req &&
      opts.req.query
    ) {
      Object.assign(meta, normalizeMetaForRender({ query: opts.req.query }));
    }
    const metaWithMap = attachFieldDisplayMapToMeta(meta, {
      component: opts.component || "weekly_tasks",
      title: opts.title || "Tasks",
    });
    return await renders.renderTasksPdfBufferUsingHtml(
      tasksRows,
      weeklyRows,
      metaWithMap,
    );
  },

  renderTasksPdfBufferFromXlsx: renders.renderTasksPdfBufferFromXlsx,

  createPdfFromPng: renders.createPdfFromPng,
  findLibreOfficeBinary: renders.findLibreOfficeBinary,
};
