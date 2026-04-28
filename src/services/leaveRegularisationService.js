let tenantPoolManager = null;
try {
  tenantPoolManager = require("../db/tenantPoolManager");
} catch (e) {
  tenantPoolManager = null;
}

const LEAVE_REGULARISATION_QUERIES = require("../constants/leaveRegularisationQueries");

function isValidDateString(dateStr) {
  return typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateKey(dateKey) {
  if (!isValidDateString(dateKey)) return null;
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function addDays(dateKey, days) {
  const d = parseDateKey(dateKey);
  if (!d) return null;
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

function getDateRange(fromDate, toDate) {
  const start = parseDateKey(fromDate);
  const end = parseDateKey(toDate);
  if (!start || !end) return [];

  const dates = [];
  let cur = fromDate;
  while (cur && cur <= toDate) {
    dates.push(cur);
    if (cur === toDate) break;
    cur = addDays(cur, 1);
  }
  return dates;
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isSunday(dateKey) {
  const d = parseDateKey(dateKey);
  if (!d) return false;
  return d.getDay() === 0;
}

function extractDateKey(value) {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (trimmed.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return toDateKey(d);
}

function buildAttendanceMap(rows) {
  const map = new Map();

  for (const row of rows || []) {
    const key =
      extractDateKey(row.attendance_date) ||
      extractDateKey(row.punchin_time) ||
      extractDateKey(row.punchout_time);

    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }

  for (const [key, arr] of map.entries()) {
    arr.sort((a, b) => {
      const at = new Date(a.punchin_time || a.punchout_time || 0).getTime();
      const bt = new Date(b.punchin_time || b.punchout_time || 0).getTime();
      return at - bt;
    });
    map.set(key, arr);
  }

  return map;
}

function buildLeaveSet(rows) {
  const set = new Set();

  for (const row of rows || []) {
    const start = extractDateKey(row.start_date);
    const end = extractDateKey(row.end_date);
    if (!start || !end) continue;

    let cur = start;
    while (cur && cur <= end) {
      set.add(cur);
      if (cur === end) break;
      cur = addDays(cur, 1);
    }
  }

  return set;
}

function buildHolidaySet(rows) {
  const set = new Set();
  for (const row of rows || []) {
    const key = extractDateKey(row.date);
    if (key) set.add(key);
  }
  return set;
}

function hasPunchIn(rows) {
  return rows.some((r) => !!r.punchin_time);
}

function hasPunchOut(rows) {
  return rows.some((r) => !!r.punchout_time);
}

function hasAutomaticMode(rows) {
  return rows.some((r) => normalizeText(r.punchmode) === "automatic");
}

function looksLate(rows) {
  return rows.some((r) => {
    const status = normalizeText(r.punch_status);
    return status.includes("late") || status.includes("late login");
  });
}

function validateReason(reason) {
  return ["missed_punch_out", "late_login", "missed_apply_leave"].includes(
    reason,
  );
}

function validateRange(fromDate, toDate) {
  if (!isValidDateString(fromDate) || !isValidDateString(toDate)) {
    return {
      valid: false,
      message: "Invalid date format. Use YYYY-MM-DD.",
    };
  }

  if (fromDate > toDate) {
    return {
      valid: false,
      message: "'fromDate' must be on or before 'toDate'.",
    };
  }

  const days = getDateRange(fromDate, toDate);
  if (days.length > 31) {
    return {
      valid: false,
      message: "Date range must not exceed 31 days.",
    };
  }

  return { valid: true };
}

function getTenantPool(orgId) {
  if (
    !tenantPoolManager ||
    typeof tenantPoolManager.getTenantPool !== "function"
  ) {
    throw new Error("tenantPoolManager is not available.");
  }

  const sanitizeDbName = tenantPoolManager.sanitizeDbName || ((n) => n);
  const dbName = sanitizeDbName(`tenant_${orgId}`);
  return tenantPoolManager.getTenantPool(dbName);
}

async function queryTenant(orgId, sql, params = []) {
  const pool = await getTenantPool(orgId);
  if (!pool || typeof pool.execute !== "function") {
    throw new Error("Tenant pool is not available.");
  }
  return pool.execute(sql, params);
}

function evaluateDateForReason(
  dateKey,
  reason,
  attendanceMap,
  leaveSet,
  holidaySet,
) {
  if (!dateKey) return false;
  if (holidaySet.has(dateKey)) return false;
  if (isSunday(dateKey)) return false;
  if (leaveSet.has(dateKey)) return false;

  const rows = attendanceMap.get(dateKey) || [];
  const hasRows = rows.length > 0;
  const punchIn = hasPunchIn(rows);
  const punchOut = hasPunchOut(rows);
  const automatic = hasAutomaticMode(rows);

  if (reason === "missed_punch_out") {
    return hasRows && automatic;
  }

  if (reason === "late_login") {
    return hasRows && looksLate(rows);
  }

  if (reason === "missed_apply_leave") {
    return !hasRows || (!punchIn && !punchOut);
  }

  return false;
}

function capitalizeStatus(status) {
  const s = String(status || "")
    .trim()
    .toLowerCase();
  if (!s) return "";
  if (s === "pending") return "Pending";
  if (s === "approved") return "Approved";
  if (s === "rejected") return "Rejected";
  return "";
}

function normalizeRole(role) {
  return String(role || "")
    .toLowerCase()
    .replace(/[_\s]+/g, " ")
    .trim();
}

async function hasColumn(orgId, tableName, columnName) {
  const [rows] = await queryTenant(
    orgId,
    `
      SELECT COUNT(*) AS cnt
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [tableName, columnName],
  );

  return Number(rows?.[0]?.cnt || 0) > 0;
}

function buildRegularisationListQuery({
  orgId,
  scope,
  role,
  employeeId,
  employeeIds = [],
  status = "",
  fromDate = "",
  toDate = "",
  search = "",
}) {
  const normalizedScope = String(scope || "self")
    .trim()
    .toLowerCase();
  const normalizedRole = normalizeRole(role);
  const normalizedStatus = capitalizeStatus(status);
  const searchTerm = String(search || "")
    .trim()
    .toLowerCase();

  const where = [];
  const params = [];

  if (normalizedScope === "all" || normalizedRole === "admin") {
    where.push("l.org_id = ?");
    params.push(orgId);
  } else if (normalizedScope === "team") {
    const ids = Array.isArray(employeeIds)
      ? employeeIds.map((v) => String(v).trim()).filter(Boolean)
      : [];

    where.push("l.org_id = ?");
    params.push(orgId);

    if (ids.length > 0) {
      where.push(`l.employee_id IN (${ids.map(() => "?").join(",")})`);
      params.push(...ids);
    } else if (employeeId) {
      where.push("l.employee_id = ?");
      params.push(employeeId);
    }
  } else {
    where.push("l.org_id = ?");
    params.push(orgId);
    if (employeeId) {
      where.push("l.employee_id = ?");
      params.push(employeeId);
    }
  }

  if (normalizedStatus) {
    where.push("l.status = ?");
    params.push(normalizedStatus);
  }

  if (isValidDateString(fromDate)) {
    where.push("DATE(COALESCE(l.primary_date, l.created_at)) >= ?");
    params.push(fromDate);
  }

  if (isValidDateString(toDate)) {
    where.push("DATE(COALESCE(l.primary_date, l.created_at)) <= ?");
    params.push(toDate);
  }

  if (searchTerm) {
    const like = `%${searchTerm}%`;
    where.push(
      `(LOWER(COALESCE(e.first_name, '')) LIKE ?
        OR LOWER(COALESCE(e.last_name, '')) LIKE ?
        OR LOWER(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))) LIKE ?
        OR LOWER(l.employee_id) LIKE ?
        OR LOWER(l.regularisation_type) LIKE ?
        OR LOWER(COALESCE(l.comment, '')) LIKE ?
        OR LOWER(COALESCE(l.approver_comments, '')) LIKE ?)`,
    );
    params.push(like, like, like, like, like, like, like);
  }

  let sql = "";

  if (normalizedScope === "all" || normalizedRole === "admin") {
    sql = LEAVE_REGULARISATION_QUERIES.GET_ALL_REGULARISATION_REQUESTS;
  } else if (
    normalizedScope === "team" &&
    Array.isArray(employeeIds) &&
    employeeIds.length > 0
  ) {
    sql =
      LEAVE_REGULARISATION_QUERIES.GET_TEAM_REGULARISATION_REQUESTS_BY_EMPLOYEE_IDS;
  } else {
    sql = LEAVE_REGULARISATION_QUERIES.GET_MY_REGULARISATION_REQUESTS;
  }

  return { sql, params };
}

async function getEligibleDates({
  employeeId,
  orgId,
  regularisationType,
  fromDate,
  toDate,
}) {
  const reason = String(regularisationType || "").trim();

  if (!employeeId || !orgId) {
    return {
      success: false,
      status: 400,
      message: "Employee ID and Org ID are required.",
    };
  }

  if (!validateReason(reason)) {
    return {
      success: false,
      status: 400,
      message: "Invalid regularisation type.",
    };
  }

  const rangeCheck = validateRange(fromDate, toDate);
  if (!rangeCheck.valid) {
    return {
      success: false,
      status: 400,
      message: rangeCheck.message,
    };
  }

  let attendanceRows = [];
  let leaveRows = [];
  let holidayRows = [];

  try {
    [attendanceRows] = await queryTenant(
      orgId,
      LEAVE_REGULARISATION_QUERIES.GET_ATTENDANCE_RECORDS_BY_RANGE,
      [employeeId, orgId, fromDate, toDate],
    );

    [leaveRows] = await queryTenant(
      orgId,
      LEAVE_REGULARISATION_QUERIES.GET_APPROVED_LEAVES_BY_RANGE,
      [employeeId, orgId, toDate, fromDate],
    );

    [holidayRows] = await queryTenant(
      orgId,
      LEAVE_REGULARISATION_QUERIES.GET_HOLIDAYS_BY_RANGE,
      [fromDate, toDate],
    );
  } catch (err) {
    console.error("[getEligibleDates] query error:", err);
    return {
      success: false,
      status: 500,
      message: "Failed to fetch eligible dates.",
    };
  }

  const attendanceMap = buildAttendanceMap(attendanceRows);
  const leaveSet = buildLeaveSet(leaveRows);
  const holidaySet = buildHolidaySet(holidayRows);

  const allDates = getDateRange(fromDate, toDate);
  const eligibleDates = allDates.filter((dateKey) =>
    evaluateDateForReason(dateKey, reason, attendanceMap, leaveSet, holidaySet),
  );

  return {
    success: true,
    status: 200,
    message: "Eligible dates fetched successfully.",
    data: {
      regularisationType: reason,
      fromDate,
      toDate,
      eligibleDates,
      totalEligible: eligibleDates.length,
    },
  };
}

async function submitRegularisation({
  employeeId,
  orgId,
  regularisationType,
  selectedDates,
  comment,
}) {
  const reason = String(regularisationType || "").trim();
  const dates = Array.isArray(selectedDates) ? selectedDates : [];
  const cleanDates = [...new Set(dates.map((d) => String(d).trim()))].filter(
    isValidDateString,
  );

  if (!employeeId || !orgId) {
    return {
      success: false,
      status: 400,
      message: "Employee ID and Org ID are required.",
    };
  }

  if (!validateReason(reason)) {
    return {
      success: false,
      status: 400,
      message: "Invalid regularisation type.",
    };
  }

  if (cleanDates.length === 0) {
    return {
      success: false,
      status: 400,
      message: "Please select at least one valid date.",
    };
  }

  if (!comment || !String(comment).trim()) {
    return {
      success: false,
      status: 400,
      message: "Comment is required.",
    };
  }

  for (const dateKey of cleanDates) {
    const eligible = await getEligibleDates({
      employeeId,
      orgId,
      regularisationType: reason,
      fromDate: dateKey,
      toDate: dateKey,
    });

    if (!eligible.success) return eligible;

    const allowed = new Set(eligible.data.eligibleDates || []);
    if (!allowed.has(dateKey)) {
      return {
        success: false,
        status: 400,
        message: `Selected date ${dateKey} is not eligible for ${reason}.`,
      };
    }
  }

  const sortedDates = [...cleanDates].sort();
  const primaryDate = sortedDates[0];

  const [existingRows] = await queryTenant(
    orgId,
    LEAVE_REGULARISATION_QUERIES.GET_EXISTING_REQUEST_BY_PRIMARY_DATE,
    [employeeId, orgId, reason, primaryDate],
  );

  if (existingRows && existingRows.length > 0) {
    return {
      success: false,
      status: 409,
      message: "A regularisation request already exists for this date.",
    };
  }

  try {
    const [insertResult] = await queryTenant(
      orgId,
      LEAVE_REGULARISATION_QUERIES.INSERT_REGULARISATION_REQUEST,
      [
        orgId,
        employeeId,
        reason,
        JSON.stringify(sortedDates),
        primaryDate,
        String(comment).trim(),
      ],
    );

    return {
      success: true,
      status: 200,
      message: "Regularisation request submitted successfully.",
      data: {
        requestId: insertResult.insertId,
        regularisationType: reason,
        primaryDate,
        selectedDates: sortedDates,
        status: "Pending",
      },
    };
  } catch (err) {
    console.error("[submitRegularisation] insert error:", err);
    return {
      success: false,
      status: 500,
      message:
        err?.sqlMessage ||
        err?.message ||
        "Failed to save regularisation request.",
    };
  }
}

async function getRegularisationRequests({
  employeeId,
  orgId,
  role = "",
  scope = "self",
  status = "",
  fromDate = "",
  toDate = "",
  search = "",
  employeeIds = [],
}) {
  if (!orgId) {
    return {
      success: false,
      status: 400,
      message: "Org ID is required.",
    };
  }

  const normalizedScope = String(scope || "self")
    .trim()
    .toLowerCase();
  const normalizedRole = normalizeRole(role);

  let sql = "";
  let params = [];

  if (normalizedScope === "all" || normalizedRole === "admin") {
    sql = LEAVE_REGULARISATION_QUERIES.GET_ALL_REGULARISATION_REQUESTS;
    params = [orgId];
  } else if (normalizedScope === "team") {
    const ids = Array.isArray(employeeIds)
      ? employeeIds.map((v) => String(v).trim()).filter(Boolean)
      : [];

    if (ids.length > 0) {
      sql =
        LEAVE_REGULARISATION_QUERIES.GET_TEAM_REGULARISATION_REQUESTS_BY_EMPLOYEE_IDS;
      params = [orgId, ids];
      const [rows] = await queryTenant(orgId, sql, params);
      return {
        success: true,
        status: 200,
        message: "Regularisation requests fetched successfully.",
        data: rows || [],
      };
    }

    sql = LEAVE_REGULARISATION_QUERIES.GET_MY_REGULARISATION_REQUESTS;
    params = [employeeId, orgId];
  } else {
    sql = LEAVE_REGULARISATION_QUERIES.GET_MY_REGULARISATION_REQUESTS;
    params = [employeeId, orgId];
  }

  const filters = [];
  const filterParams = [];

  if (status) {
    const normalizedStatus = capitalizeStatus(status);
    if (normalizedStatus) {
      filters.push("l.status = ?");
      filterParams.push(normalizedStatus);
    }
  }

  if (isValidDateString(fromDate)) {
    filters.push("DATE(COALESCE(l.primary_date, l.created_at)) >= ?");
    filterParams.push(fromDate);
  }

  if (isValidDateString(toDate)) {
    filters.push("DATE(COALESCE(l.primary_date, l.created_at)) <= ?");
    filterParams.push(toDate);
  }

  if (String(search || "").trim()) {
    const like = `%${String(search).trim().toLowerCase()}%`;
    filters.push(
      `(LOWER(COALESCE(e.first_name, '')) LIKE ?
        OR LOWER(COALESCE(e.last_name, '')) LIKE ?
        OR LOWER(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))) LIKE ?
        OR LOWER(l.employee_id) LIKE ?
        OR LOWER(l.regularisation_type) LIKE ?
        OR LOWER(COALESCE(l.comment, '')) LIKE ?
        OR LOWER(COALESCE(l.approver_comments, '')) LIKE ?)`,
    );
    filterParams.push(like, like, like, like, like, like, like);
  }

  if (filters.length > 0) {
    const baseQuery = sql.trim().replace(/ORDER BY[\s\S]*$/i, "");
    sql = `
      ${baseQuery}
      ${baseQuery.toLowerCase().includes("where") ? "AND" : "WHERE"}
      ${filters.join(" AND ")}
      ORDER BY l.created_at DESC
    `;
  }

  const [rows] = await queryTenant(orgId, sql, params.concat(filterParams));

  return {
    success: true,
    status: 200,
    message: "Regularisation requests fetched successfully.",
    data: rows || [],
  };
}

async function getMyRegularisationRequests({ employeeId, orgId }) {
  return getRegularisationRequests({
    employeeId,
    orgId,
    scope: "self",
  });
}

async function updateRegularisationRequest({
  orgId,
  employeeId,
  role,
  id,
  status,
  approverComments = "",
  approverName = "",
  approverId = "",
}) {
  if (!orgId || !employeeId || !id) {
    return {
      success: false,
      status: 400,
      message: "Missing org_id, employee_id or request id.",
    };
  }

  const normalizedStatus = capitalizeStatus(status);
  if (!normalizedStatus) {
    return {
      success: false,
      status: 400,
      message: "Invalid status.",
    };
  }

  const normalizedRole = normalizeRole(role);
  const canManage = [
    "admin",
    "hr",
    "manager",
    "supervisor",
    "super admin",
    "superadmin",
    "super_admin",
  ].includes(normalizedRole);

  if (!canManage) {
    return {
      success: false,
      status: 403,
      message: "You are not allowed to update regularisation requests.",
    };
  }

  const sql = `
    UPDATE leave_regularisation_requests
    SET
      status = ?,
      approver_comments = ?,
      approver_name = ?,
      approver_employee_id = ?,
      updated_at = NOW()
    WHERE id = ? AND org_id = ?
  `;

  const params = [
    normalizedStatus,
    String(approverComments || "").trim() || null,
    String(approverName || "").trim() || null,
    String(approverId || "").trim() || null,
    id,
    orgId,
  ];

  const [result] = await queryTenant(orgId, sql, params);

  if (!result || result.affectedRows === 0) {
    return {
      success: false,
      status: 404,
      message: "Regularisation request not found.",
    };
  }

  return {
    success: true,
    status: 200,
    message: "Regularisation request updated successfully.",
    data: {
      id,
      status: normalizedStatus,
      approverComments: String(approverComments || "").trim(),
      approverName: String(approverName || "").trim(),
      approverId: String(approverId || "").trim(),
    },
  };
}

async function getRegularisationRequestById({ employeeId, orgId, id }) {
  if (!employeeId || !orgId || !id) {
    return {
      success: false,
      status: 400,
      message: "Employee ID, Org ID and request ID are required.",
    };
  }

  const [rows] = await queryTenant(
    orgId,
    LEAVE_REGULARISATION_QUERIES.GET_REGULARISATION_REQUEST_BY_ID,
    [id, employeeId, orgId],
  );

  return {
    success: true,
    status: 200,
    message: "Regularisation request fetched successfully.",
    data: rows?.[0] || null,
  };
}

module.exports = {
  getEligibleDates,
  submitRegularisation,
  getRegularisationRequests,
  getMyRegularisationRequests,
  updateRegularisationRequest,
  getRegularisationRequestById,
};
