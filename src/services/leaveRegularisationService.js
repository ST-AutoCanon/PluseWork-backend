let tenantPoolManager = null;
try {
  tenantPoolManager = require("../db/tenantPoolManager");
} catch (e) {
  tenantPoolManager = null;
}

const LEAVE_REGULARISATION_QUERIES = require("../constants/leaveRegularisationQueries");
const attendanceService = require("./attendanceService");

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
    // Check explicit late_login column first
    if (r.late_login && Number(r.late_login) === 1) {
      return true;
    }
    // Fallback to punch_status text matching
    const status = normalizeText(r.punch_status);
    return status.includes("late") || status.includes("late login");
  });
}

function validateReason(reason) {
  return [
    "missed_punch_out",
    "late_login",
    "missed_apply_leave",
    "deficit_in_punch_hours",
  ].includes(reason);
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

async function hasColumn(orgId, tableName, columnName) {
  if (!orgId || !tableName || !columnName) return false;

  try {
    const [rows] = await queryTenant(
      orgId,
      `
        SELECT 1 AS exists_flag
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
        LIMIT 1
      `,
      [tableName, columnName],
    );

    return Array.isArray(rows) && rows.length > 0;
  } catch (err) {
    console.warn(
      "[hasColumn] check failed:",
      err?.sqlMessage || err?.message || err,
    );
    return false;
  }
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
  } catch (err) {
    console.warn(
      "[getEligibleDates] attendance query failed:",
      err?.sqlMessage || err?.message || err,
    );
    attendanceRows = [];
  }

  try {
    [leaveRows] = await queryTenant(
      orgId,
      LEAVE_REGULARISATION_QUERIES.GET_APPROVED_LEAVES_BY_RANGE,
      [employeeId, orgId, toDate, fromDate],
    );
  } catch (err) {
    console.warn(
      "[getEligibleDates] leave query failed:",
      err?.sqlMessage || err?.message || err,
    );
    leaveRows = [];
  }

  try {
    [holidayRows] = await queryTenant(
      orgId,
      LEAVE_REGULARISATION_QUERIES.GET_HOLIDAYS_BY_RANGE,
      [fromDate, toDate],
    );
  } catch (err) {
    console.warn(
      "[getEligibleDates] holiday query failed:",
      err?.sqlMessage || err?.message || err,
    );
    holidayRows = [];
  }

  const attendanceMap = buildAttendanceMap(attendanceRows);
  const leaveSet = buildLeaveSet(leaveRows);
  const holidaySet = buildHolidaySet(holidayRows);

  // Fetch login-hours configuration for org (used for late/deficit detection)
  let config = null;
  try {
    config = await attendanceService.getLoginHoursConfig(orgId);
  } catch (e) {
    config = null;
  }

  // Defaults when config missing
  const bufferMinutes = config?.buffer_minutes ?? config?.bufferMinutes ?? 10;
  const punchInStart = config?.punch_in_start ?? config?.punchInStart ?? null;
  const requiredDailyMinutes =
    config?.required_daily_minutes ?? config?.requiredDailyMinutes ?? 480;
  const allowedLateStreaks =
    config?.allowed_late_streaks ?? config?.allowedLateStreaks ?? 2;
  const streakPeriod =
    config?.streak_period ?? config?.streakPeriod ?? "monthly";

  // Precompute late dates across the range (based on punchInStart + buffer)
  const allDates = getDateRange(fromDate, toDate);
  const lateDates = [];
  for (const dateKey of allDates) {
    const rows = attendanceMap.get(dateKey) || [];
    // determine earliest punch-in time
    const earliest = rows
      .filter((r) => r.punchin_time)
      .map((r) => r.punchin_time)
      .sort()[0];
    if (earliest && punchInStart) {
      try {
        const earliestTime = new Date(earliest);
        // build comparison time as dateKey + punchInStart
        const cmp = new Date(`${dateKey}T${punchInStart}`);
        cmp.setMinutes(cmp.getMinutes() + Number(bufferMinutes || 0));
        if (earliestTime > cmp) {
          lateDates.push(dateKey);
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  }

  const eligibleDates = getDateRange(fromDate, toDate).filter((dateKey) =>
    evaluateDateForReason(
      dateKey,
      reason,
      attendanceMap,
      leaveSet,
      holidaySet,
      {
        punchInStart,
        bufferMinutes,
        requiredDailyMinutes,
        allowedLateStreaks,
        streakPeriod,
        lateDates,
      },
    ),
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

function evaluateDateForReason(
  dateKey,
  reason,
  attendanceMap,
  leaveSet,
  holidaySet,
  config = {},
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
    // Prefer precise detection if punchInStart provided
    const {
      punchInStart,
      bufferMinutes,
      allowedLateStreaks,
      streakPeriod,
      lateDates = [],
    } = config || {};

    let isLate = false;
    if (punchInStart) {
      const earliest = rows
        .filter((r) => r.punchin_time)
        .map((r) => r.punchin_time)
        .sort()[0];
      if (earliest) {
        try {
          const earliestTime = new Date(earliest);
          const cmp = new Date(`${dateKey}T${punchInStart}`);
          cmp.setMinutes(cmp.getMinutes() + Number(bufferMinutes || 0));
          isLate = earliestTime > cmp;
        } catch (e) {
          isLate = looksLate(rows);
        }
      } else {
        isLate = false;
      }
    } else {
      isLate = looksLate(rows);
    }

    if (!isLate) return false;

    // Check streak thresholds — count late dates in the relevant window
    const dt = parseDateKey(dateKey);
    if (!dt) return true; // fallback: include

    let windowStartKey = null;
    if ((streakPeriod || "monthly") === "monthly") {
      const start = new Date(dt.getFullYear(), dt.getMonth(), 1);
      windowStartKey = toDateKey(start);
    } else {
      // 15 days period: inclusive of current date and previous 14 days
      const prev = new Date(dt);
      prev.setDate(prev.getDate() - 14);
      windowStartKey = toDateKey(prev);
    }

    const countInWindow = (lateDates || []).filter(
      (d) => d >= windowStartKey && d <= dateKey,
    ).length;
    const allowed = Number(allowedLateStreaks || 0);
    // If allowed is zero, any late counts as eligible; otherwise require count > allowed
    if (allowed <= 0) return true;
    return countInWindow > allowed;
  }

  if (reason === "missed_apply_leave") {
    return !hasRows || (!punchIn && !punchOut);
  }

  if (reason === "deficit_in_punch_hours") {
    // Sum minutes worked in the day's rows
    const required = Number(config?.requiredDailyMinutes || 480);
    let worked = 0;
    for (const r of rows) {
      if (r.punchin_time && r.punchout_time) {
        const inT = new Date(r.punchin_time);
        const outT = new Date(r.punchout_time);
        if (
          !Number.isNaN(inT.getTime()) &&
          !Number.isNaN(outT.getTime()) &&
          outT > inT
        ) {
          worked += Math.round((outT - inT) / 60000);
        }
      }
    }

    return worked < required && worked > 0;
  }

  return false;
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

  const applyFilters = (sql, baseParams = []) => {
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

    return { sql, params: baseParams.concat(filterParams) };
  };

  if (normalizedScope === "all" || normalizedRole === "admin") {
    let sql = LEAVE_REGULARISATION_QUERIES.GET_ALL_REGULARISATION_REQUESTS;
    const final = applyFilters(sql, [orgId]);
    const [rows] = await queryTenant(orgId, final.sql, final.params);

    return {
      success: true,
      status: 200,
      message: "Regularisation requests fetched successfully.",
      data: rows || [],
    };
  }

  if (normalizedScope === "team") {
    let sql = "";
    let params = [];

    if (normalizedRole === "manager") {
      sql =
        LEAVE_REGULARISATION_QUERIES.GET_TEAM_REGULARISATION_REQUESTS_BY_DEPARTMENT;
      params = [employeeId, orgId, employeeId];
    } else if (normalizedRole === "supervisor") {
      sql =
        LEAVE_REGULARISATION_QUERIES.GET_TEAM_REGULARISATION_REQUESTS_BY_SUPERVISOR;
      params = [orgId, employeeId, employeeId];
    } else {
      sql =
        LEAVE_REGULARISATION_QUERIES.GET_TEAM_REGULARISATION_REQUESTS_BY_DEPARTMENT;
      params = [employeeId, orgId, employeeId];
    }

    const final = applyFilters(sql, params);
    const [rows] = await queryTenant(orgId, final.sql, final.params);

    return {
      success: true,
      status: 200,
      message: "Regularisation requests fetched successfully.",
      data: rows || [],
    };
  }

  let sql = LEAVE_REGULARISATION_QUERIES.GET_MY_REGULARISATION_REQUESTS;
  const final = applyFilters(sql, [employeeId, orgId]);
  const [rows] = await queryTenant(orgId, final.sql, final.params);

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
  regularisationType = "",
  selectedDates = [],
  comment = "",
  primaryDate = "",
}) {
  if (!orgId || !employeeId || !id) {
    return {
      success: false,
      status: 400,
      message: "Missing org_id, employee_id or request id.",
    };
  }

  const normalizedRole = normalizeRole(role);

  const approverRoles = [
    "admin",
    "hr",
    "manager",
    "supervisor",
    "super admin",
    "superadmin",
    "super_admin",
  ];

  const isApprover = approverRoles.includes(normalizedRole);

  const [rows] = await queryTenant(
    orgId,
    `
      SELECT id, employee_id, status
      FROM leave_regularisation_requests
      WHERE id = ? AND org_id = ?
      LIMIT 1
    `,
    [id, orgId],
  );

  const existing = rows?.[0];
  if (!existing) {
    return {
      success: false,
      status: 404,
      message: "Regularisation request not found.",
    };
  }

  const isOwner =
    String(existing.employee_id).trim() === String(employeeId).trim();

  const hasEditPayload =
    (Array.isArray(selectedDates) && selectedDates.length > 0) ||
    String(regularisationType || "").trim() !== "" ||
    String(comment || "").trim() !== "" ||
    String(primaryDate || "").trim() !== "";

  const hasApproverPayload =
    String(status || "").trim() !== "" ||
    String(approverComments || "").trim() !== "" ||
    String(approverName || "").trim() !== "";

  if (isOwner && hasEditPayload) {
    if (
      String(existing.status || "")
        .trim()
        .toLowerCase() !== "pending"
    ) {
      return {
        success: false,
        status: 403,
        message: "Only pending regularisation requests can be edited.",
      };
    }

    const cleanDates = Array.isArray(selectedDates)
      ? [...new Set(selectedDates.map((d) => String(d).trim()))].filter(
          isValidDateString,
        )
      : [];

    if (cleanDates.length === 0) {
      return {
        success: false,
        status: 400,
        message: "Please select at least one valid date.",
      };
    }

    const tableName = "leave_regularisation_requests";
    const canUseSelectedDatesJson = await hasColumn(
      orgId,
      tableName,
      "selected_dates_json",
    );
    const canUseRegularisationType = await hasColumn(
      orgId,
      tableName,
      "regularisation_type",
    );
    const canUseComment = await hasColumn(orgId, tableName, "comment");
    const canUseComments = await hasColumn(orgId, tableName, "comments");

    const setParts = [];
    const params = [];

    if (canUseRegularisationType) {
      setParts.push("regularisation_type = ?");
      params.push(String(regularisationType || "").trim());
    }

    setParts.push("selected_dates = ?");
    params.push(JSON.stringify(cleanDates));

    if (canUseSelectedDatesJson) {
      setParts.push("selected_dates_json = ?");
      params.push(JSON.stringify(cleanDates));
    }

    setParts.push("primary_date = ?");
    params.push(primaryDate || cleanDates[0] || null);

    if (canUseComment) {
      setParts.push("comment = ?");
      params.push(String(comment || "").trim());
    } else if (canUseComments) {
      setParts.push("comments = ?");
      params.push(String(comment || "").trim());
    }

    setParts.push("updated_at = NOW()");

    const sql = `
      UPDATE leave_regularisation_requests
      SET ${setParts.join(", ")}
      WHERE id = ? AND org_id = ? AND employee_id = ?
    `;

    params.push(id, orgId, employeeId);

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
        regularisationType: String(regularisationType || "").trim(),
        selectedDates: cleanDates,
        primaryDate: primaryDate || cleanDates[0] || null,
        comment: String(comment || "").trim(),
      },
    };
  }

  if (hasApproverPayload && !isApprover) {
    return {
      success: false,
      status: 403,
      message: "You are not allowed to update regularisation requests.",
    };
  }

  if (!isApprover) {
    return {
      success: false,
      status: 403,
      message: "You are not allowed to update regularisation requests.",
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
