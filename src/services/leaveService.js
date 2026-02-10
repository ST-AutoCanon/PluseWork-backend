// services/leaveService.js
const fs = require("fs");
const path = require("path");
const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const queries = require("../constants/leaveQueries");
const LeavePolicyService = require("./leavePolicyService");

const FILE_BASE_URL = process.env.FILE_BASE_URL || ""; // optional

const toLocalDateString = (dateInput) => {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateOnly = (isoDate) => {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (!isNaN(d.getTime())) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  const parts = String(isoDate).split("-");
  if (parts.length >= 3) {
    const [y, m, day] = parts;
    return new Date(Number(y), Number(m) - 1, Number(day));
  }
  return null;
};

const computeInclusiveDays = (startDateStr, endDateStr, h_f_day = "") => {
  if (!startDateStr || !endDateStr) return 0;
  const start = parseDateOnly(startDateStr);
  const end = parseDateOnly(endDateStr);
  if (!start || !end || end < start) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = end - start;
  const dayCount = Math.round(diff / msPerDay) + 1;
  if (
    String(h_f_day).toLowerCase().includes("half") &&
    start.getTime() === end.getTime()
  ) {
    return 0.5;
  }
  return dayCount;
};

const getTenantPool = async (orgId) => {
  if (!orgId) throw new Error("orgId required");
  return getTenantPoolByOrgId(orgId);
};

const getEmployeeProfile = async (employeeId, orgId) => {
  if (!orgId) throw new Error("orgId required");
  if (!employeeId) return null;
  const tenantPool = await getTenantPool(orgId);
  try {
    const sql = `
      SELECT e.employee_id, e.dob, ep.gender
      FROM employees e
      LEFT JOIN employee_personal ep ON e.employee_id = ep.employee_id
      WHERE e.employee_id = ?
      LIMIT 1
    `;
    const [rows] = await tenantPool.execute(sql, [employeeId]);
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return { employee_id: r.employee_id, dob: r.dob, gender: r.gender };
  } catch (err) {
    console.error("[getEmployeeProfile] error:", err);
    return null;
  }
};

const getLeaveTypes = async (orgId) => {
  if (!orgId) throw new Error("orgId required");
  const tenantPool = await getTenantPool(orgId);
  const [rows] = await tenantPool.execute(queries.GET_LEAVE_TYPES, [orgId]);
  return (rows || []).map((r) => ({
    id: r.id,
    key: r.type_key ? String(r.type_key).trim().toLowerCase() : null,
    label: r.display_name || r.type_key,
    gender: r.gender || "All",
    min_age: r.min_age == null ? null : Number(r.min_age),
    max_age: r.max_age == null ? null : Number(r.max_age),
    is_active: !!Number(r.is_active),
  }));
};

const getLeaveTypeByKey = async (orgId, keyOrId) => {
  if (!orgId) throw new Error("orgId required");
  if (!keyOrId) return null;
  const tenantPool = await getTenantPool(orgId);
  try {
    const [rows] = await tenantPool.execute(queries.GET_LEAVE_TYPE_BY_KEY, [
      orgId,
      keyOrId,
      keyOrId,
    ]);
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      key: String(r.key || r.type_key || "").trim(),
      label: r.label || r.display_name || r.key || "",
      gender: r.gender || null,
      min_age: r.min_age === null ? null : Number(r.min_age),
      max_age: r.max_age === null ? null : Number(r.max_age),
      is_active: Number(r.is_active) === 1,
    };
  } catch (err) {
    console.error("[getLeaveTypeByKey] error:", err);
    return null;
  }
};

const getEmployeePersonal = async (employeeId, orgId) => {
  if (!employeeId) return null;
  const tenantPool = await getTenantPool(orgId);
  const [rows] = await tenantPool.execute(queries.GET_EMPLOYEE_PERSONAL, [
    employeeId,
  ]);
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  return {
    employee_id: r.employee_id,
    dob: r.employee_dob || null,
    gender: r.personal_gender || r.gender || null,
    spouse_dob: r.spouse_dob || null,
    child1_dob: r.child1_dob || null,
    child2_dob: r.child2_dob || null,
    child3_dob: r.child3_dob || null,
  };
};

const computeAgeYears = (dobStr) => {
  if (!dobStr) return null;
  const d = new Date(dobStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
};

/**
 * Validate requested leave type for an employee (gender + age)
 * Throws Error if not allowed.
 */
const validateLeaveTypeEligibility = async (employeeId, leaveKey, orgId) => {
  if (!orgId) throw new Error("orgId required");
  if (!employeeId) throw new Error("employeeId required");
  if (!leaveKey) throw new Error("leave type is required");

  const leaveType = await getLeaveTypeByKey(orgId, leaveKey);
  if (!leaveType || !leaveType.is_active) {
    const err = new Error("Selected leave type is not available.");
    err.isBadRequest = true;
    throw err;
  }

  const personal = await getEmployeePersonal(employeeId, orgId);
  const gender =
    personal && personal.gender ? String(personal.gender).toLowerCase() : null;
  const dob = personal && personal.dob ? personal.dob : null;
  const age = computeAgeYears(dob);

  const reqGender = (leaveType.gender || "All").toString().toLowerCase();
  if (reqGender !== "all" && reqGender !== "" && gender) {
    if (reqGender !== gender) {
      const err = new Error(
        "You are not eligible for the selected leave type (gender restriction).",
      );
      err.isBadRequest = true;
      throw err;
    }
  }

  if (
    leaveType.min_age !== null &&
    age !== null &&
    age < Number(leaveType.min_age)
  ) {
    const err = new Error(
      `You must be at least ${leaveType.min_age} year(s) old for this leave type.`,
    );
    err.isBadRequest = true;
    throw err;
  }
  if (
    leaveType.max_age !== null &&
    age !== null &&
    age > Number(leaveType.max_age)
  ) {
    const err = new Error(
      `This leave type is available up to ${leaveType.max_age} year(s) of age.`,
    );
    err.isBadRequest = true;
    throw err;
  }

  return { ok: true, leaveType, age, gender };
};

const getLeaveQueries = async (filters = {}) => {
  const { status, search, from_date, to_date, org_id } = filters;
  if (!org_id) throw new Error("org_id is required in request headers");
  const tenantPool = await getTenantPool(org_id);

  try {
    let query = queries.GET_LEAVE_QUERIES;
    const params = [];
    const whereConditions = [];

    query += ` AND lq.org_id = ?`;
    params.push(org_id);

    if (status) {
      whereConditions.push("lq.status = ?");
      params.push(status);
    }
    if (search) {
      whereConditions.push(
        `(lq.employee_id LIKE ? OR lq.reason LIKE ? OR CONCAT(e.first_name, ' ', e.last_name) LIKE ?)`,
      );
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (from_date) {
      whereConditions.push("lq.start_date >= ?");
      params.push(from_date);
    }
    if (to_date) {
      whereConditions.push("lq.end_date <= ?");
      params.push(to_date);
    }
    if (whereConditions.length > 0) {
      query += ` AND ${whereConditions.join(" AND ")}`;
    }

    const [rows] = await tenantPool.execute(query, params);
    rows.forEach((r) => {
      r.start_date = toLocalDateString(r.start_date);
      r.end_date = toLocalDateString(r.end_date);
    });
    return rows;
  } catch (err) {
    console.error("Error fetching leave queries:", err);
    throw new Error("Failed to fetch leave queries.");
  }
};

/**
 * updateLeaveRequest(payload, orgId)
 */
const updateLeaveRequest = async (payload, orgId) => {
  const {
    leaveId,
    status,
    comments = null,
    compensated_days = 0,
    deducted_days = 0,
    loss_of_pay_days = 0,
    preserved_leave_days = null,
    actorId = null,
    total_days = null,
    is_defaulted = false,
  } = payload;

  if (!orgId) throw new Error("orgId required");

  const bind = (v) => (v === undefined ? null : v);

  const tenantPool = await getTenantPool(orgId);

  let conn = null;
  let transactionStarted = false;
  try {
    const [leaveRows] = await tenantPool.execute(queries.GET_LEAVE_BY_LEAVEID, [
      leaveId,
    ]);
    if (!leaveRows || leaveRows.length === 0) {
      const err = new Error("Leave request not found.");
      err.isBadRequest = true;
      throw err;
    }
    const leave = leaveRows[0];

    const currentStatus = (leave.status || "").toLowerCase();
    if (currentStatus && currentStatus !== "pending") {
      const err = new Error(
        "Leave request cannot be modified after it has been processed.",
      );
      err.isBadRequest = true;
      throw err;
    }

    const computedTotalDays = computeInclusiveDays(
      leave.start_date,
      leave.end_date,
      leave.H_F_day,
    );
    const EPS = 1e-6;
    let totalDays;
    if (
      total_days !== null &&
      total_days !== undefined &&
      !isNaN(Number(total_days))
    ) {
      totalDays = Number(total_days);
      if (Math.abs(totalDays - computedTotalDays) > EPS) {
        const err = new Error(
          `Client total_days (${totalDays}) does not match server computed days (${computedTotalDays}).`,
        );
        err.isBadRequest = true;
        throw err;
      }
    } else {
      totalDays = computedTotalDays;
    }

    let remaining = 0;
    try {
      const [balRows] = await tenantPool.execute(
        `SELECT remaining FROM employee_leave_balances WHERE employee_id = ? AND leave_type = ? LIMIT 1`,
        [leave.employee_id, leave.leave_type],
      );
      remaining = (balRows && balRows[0] && Number(balRows[0].remaining)) || 0;
    } catch (err) {
      if (err && err.code === "ER_NO_SUCH_TABLE") {
        console.warn("employee_leave_balances missing — treating remaining=0.");
        remaining = 0;
      } else {
        throw err;
      }
    }

    if (status === "Approved") {
      const c = Number(compensated_days) || 0;
      const d = Number(deducted_days) || 0;
      const l = Number(loss_of_pay_days) || 0;

      if (Math.abs(c + d + l - totalDays) > EPS) {
        const err = new Error(
          `Split values must add up to total requested days (${totalDays}). Received: compensated=${c}, deducted=${d}, loss_of_pay=${l}.`,
        );
        err.isBadRequest = true;
        throw err;
      }

      conn = await tenantPool.getConnection();
      try {
        await conn.beginTransaction();
        transactionStarted = true;
      } catch (e) {
        try {
          conn.release();
        } catch (_) {}
        throw e;
      }

      try {
        const c_write = Number(c.toFixed(2));
        const d_write = Number(d.toFixed(2));
        const l_write = Number(l.toFixed(2));
        const preserved_write =
          preserved_leave_days === null
            ? null
            : Number(Number(preserved_leave_days).toFixed(2));
        const isDefaultFlagNum = is_defaulted ? 1 : 0;

        const paramsUpdateLeave = [
          bind(status),
          bind(comments),
          bind(c_write),
          bind(d_write),
          bind(isDefaultFlagNum ? 0 : l_write),
          bind(preserved_write),
          bind(isDefaultFlagNum),
          bind(leaveId),
        ];

        await conn.execute(
          queries.UPDATE_LEAVE_STATUS_EXTENDED,
          paramsUpdateLeave,
        );

        if (d_write > EPS) {
          try {
            await conn.execute(queries.ADJUST_LEAVE_BALANCE, [
              d_write,
              leave.employee_id,
              leave.leave_type,
            ]);
          } catch (err) {
            if (err && err.code === "ER_NO_SUCH_TABLE") {
              console.warn(
                "employee_leave_balances missing — skipping adjust.",
              );
            } else {
              throw err;
            }
          }
        }

        if (!isDefaultFlagNum && l_write > EPS) {
          await conn.execute(queries.INSERT_LOP_RECORD, [
            leave.employee_id,
            leaveId,
            l_write,
            `LoP for leave ${leaveId}`,
          ]);
        }

        try {
          const auditPayload = {
            compensated_days: c_write,
            deducted_days: d_write,
            loss_of_pay_days: isDefaultFlagNum ? 0 : l_write,
            preserved_leave_days: preserved_write,
            is_defaulted: Boolean(isDefaultFlagNum),
          };
          const auditDetails = JSON.stringify(auditPayload);

          await conn.execute(queries.INSERT_LEAVE_AUDIT, [
            leaveId,
            actorId || "system",
            `update:${status}`,
            auditDetails,
          ]);
        } catch (auditErr) {
          if (auditErr && auditErr.code === "ER_NO_SUCH_TABLE") {
            console.warn("leave_audit missing — skipping audit insert.");
          } else {
            console.error(
              "[updateLeaveRequest] audit insert failed (fatal):",
              auditErr && auditErr.message ? auditErr.message : auditErr,
            );
            throw auditErr;
          }
        }

        await conn.commit();
      } catch (txErr) {
        try {
          if (transactionStarted && conn) {
            await conn.rollback();
          }
        } catch (rbErr) {
          console.error("[updateLeaveRequest] rollback failed:", rbErr);
        }
        throw txErr;
      } finally {
        try {
          if (conn) {
            conn.release();
            conn = null;
            transactionStarted = false;
          }
        } catch (releaseErr) {
          console.warn(
            "[updateLeaveRequest] conn.release() failed:",
            releaseErr,
          );
        }
      }

      // recompute monthly LOP for months spanned by leave
      try {
        const leaveStart = parseDateOnly(leave.start_date);
        const leaveEnd = parseDateOnly(leave.end_date);
        if (leaveStart && leaveEnd) {
          const cursor = new Date(
            leaveStart.getFullYear(),
            leaveStart.getMonth(),
            1,
          );
          const endCursor = new Date(
            leaveEnd.getFullYear(),
            leaveEnd.getMonth(),
            1,
          );
          while (cursor <= endCursor) {
            const month = cursor.getMonth() + 1;
            const year = cursor.getFullYear();
            try {
              await LeavePolicyService.computeAndStoreMonthlyLOP(
                leave.employee_id,
                month,
                year,
                orgId,
              );
            } catch (recomputeErr) {
              console.warn(
                `[updateLeaveRequest] Warning: failed to recompute monthly LOP for ${leave.employee_id} ${month}-${year}:`,
                recomputeErr && recomputeErr.message
                  ? recomputeErr.message
                  : recomputeErr,
              );
            }
            cursor.setMonth(cursor.getMonth() + 1);
          }
        } else {
          console.warn(
            "[updateLeaveRequest] Could not parse leave start/end for LOP recompute.",
          );
        }
      } catch (err) {
        console.warn(
          "[updateLeaveRequest] Unexpected error when recomputing monthly LOP:",
          err && err.message ? err.message : err,
        );
      }

      return;
    } else {
      const isDefaultFlagNum = is_defaulted ? 1 : 0;

      const paramsReject = [
        bind(status),
        bind(comments),
        bind(0),
        bind(0),
        bind(0),
        bind(preserved_leave_days),
        bind(isDefaultFlagNum),
        bind(leaveId),
      ];

      await tenantPool.execute(
        queries.UPDATE_LEAVE_STATUS_EXTENDED,
        paramsReject,
      );
      return;
    }
  } catch (err) {
    console.error(
      "Error in LeaveService.updateLeaveRequest:",
      err && err.message ? err.message : err,
    );
    throw err;
  } finally {
    try {
      if (conn) {
        try {
          if (transactionStarted) {
            await conn.rollback();
            transactionStarted = false;
          }
        } catch (rb) {}
        try {
          conn.release();
        } catch (releaseErr) {}
      }
    } catch (e) {}
  }
};

const submitLeaveRequest = async ({
  employeeId,
  startDate,
  endDate,
  h_f_day,
  reason,
  leavetype,
  orgId,
}) => {
  if (!orgId) throw new Error("orgId required");

  // Validate leave type eligibility before any DB write
  await validateLeaveTypeEligibility(employeeId, leavetype, orgId);

  const tenantPool = await getTenantPool(orgId);

  try {
    const existingLeaves = await getLeaveRequests(
      employeeId,
      null,
      null,
      orgId,
    );
    const newStartStr = startDate;
    const newEndStr = endDate;
    const isSingleOrHalf = newStartStr === newEndStr || h_f_day === "Half Day";
    const hasOverlap = existingLeaves.some((leave) => {
      const existingStartStr = toLocalDateString(leave.start_date);
      const existingEndStr = toLocalDateString(leave.end_date);
      if (isSingleOrHalf)
        return (
          existingStartStr === newStartStr || existingEndStr === newStartStr
        );
      return (
        (newStartStr >= existingStartStr && newStartStr <= existingEndStr) ||
        (newEndStr >= existingStartStr && newEndStr <= existingEndStr) ||
        (existingStartStr >= newStartStr && existingEndStr <= newEndStr)
      );
    });
    if (hasOverlap)
      throw new Error(
        "You already have a leave request on the selected date(s).",
      );

    const [result] = await tenantPool.execute(queries.INSERT_LEAVE_REQUEST, [
      employeeId,
      startDate,
      endDate,
      h_f_day,
      reason,
      leavetype,
      orgId,
    ]);
    return {
      id: result.insertId,
      orgId,
      employeeId,
      startDate,
      endDate,
      h_f_day,
      reason,
      leavetype,
      status: "Pending",
      comments: null,
    };
  } catch (err) {
    console.error(
      "Error submitting leave request:",
      err && err.message ? err.message : err,
    );
    throw new Error("Failed to submit leave request.");
  }
};

/**
 * getLeaveRequests
 */
const getLeaveRequests = async (
  employeeId,
  from_date = null,
  to_date = null,
  orgId,
) => {
  if (!orgId) throw new Error("orgId required");

  const tenantPool = await getTenantPool(orgId);

  try {
    let baseQuery = (
      queries.SELECT_LEAVE_REQUESTS ||
      `
      SELECT
        lq.id,
        lq.employee_id,
        lq.leave_type,
        lq.start_date,
        lq.end_date,
        lq.H_F_day,
        lq.reason,
        lq.status,
        lq.comments,
        lq.created_at
      FROM leavequeries lq
    `
    )
      .trim()
      .replace(/;$/, "");
    const hasWhere = /\bwhere\b/i.test(baseQuery);
    const baseHasEmployeeCondition = /\b(lq\.)?employee_id\s*=\s*\?/i.test(
      baseQuery,
    );
    const initialParams = [];
    if (baseHasEmployeeCondition && employeeId) initialParams.push(employeeId);
    const filterConditions = [];
    const filterParams = [];
    if (!baseHasEmployeeCondition && employeeId) {
      filterConditions.push("lq.employee_id = ?");
      filterParams.push(employeeId);
    }
    if (from_date) {
      filterConditions.push("lq.start_date >= ?");
      filterParams.push(from_date);
    }
    if (to_date) {
      filterConditions.push("lq.end_date <= ?");
      filterParams.push(to_date);
    }
    // Ensure tenant filter (org_id) if queries use leavequeries table
    if (!/\blq\.org_id\b/i.test(baseQuery)) {
      filterConditions.push("lq.org_id = ?");
      filterParams.push(orgId);
    }
    let finalQuery = baseQuery;
    if (filterConditions.length)
      finalQuery +=
        (hasWhere ? " AND " : " WHERE ") + filterConditions.join(" AND ");
    if (!/\border\s+by\b/i.test(finalQuery))
      finalQuery += " ORDER BY lq.created_at DESC";
    const finalParams = initialParams.concat(filterParams);
    const [rows] = await tenantPool.execute(finalQuery, finalParams);
    rows.forEach((row) => {
      row.start_date = toLocalDateString(row.start_date);
      row.end_date = toLocalDateString(row.end_date);
    });
    return rows;
  } catch (err) {
    console.error(
      "Error retrieving leave requests:",
      err && err.message ? err.message : err,
    );
    throw new Error("Failed to retrieve leave requests.");
  }
};

/**
 * editLeaveRequest: validate leave type eligibility before updating
 */
const editLeaveRequest = async ({
  leaveId,
  employeeId,
  startDate,
  endDate,
  h_f_day,
  reason,
  leavetype,
  orgId,
}) => {
  if (!orgId) throw new Error("orgId required");
  try {
    if (
      !leaveId ||
      !employeeId ||
      !startDate ||
      !endDate ||
      !h_f_day ||
      !reason ||
      !leavetype
    )
      throw new Error("All fields are required.");

    // Validate leave type eligibility BEFORE update
    await validateLeaveTypeEligibility(employeeId, leavetype, orgId);

    const tenantPool = await getTenantPool(orgId);

    const [existingLeaveRows] = await tenantPool.execute(
      queries.GET_LEAVE_BY_ID,
      [leaveId, employeeId],
    );
    if (!existingLeaveRows || existingLeaveRows.length === 0)
      throw new Error("Leave request not found or not accessible.");
    const existingLeave = existingLeaveRows[0];
    if (existingLeave.status !== "pending")
      throw new Error(
        "Leave request cannot be edited after approval or rejection.",
      );

    const [result] = await tenantPool.execute(queries.UPDATE_LEAVE_REQUEST, [
      startDate,
      endDate,
      h_f_day,
      reason,
      leavetype,
      leaveId,
      employeeId,
    ]);
    if (result.affectedRows === 0)
      throw new Error("Failed to update leave request.");
    return {
      leaveId,
      employeeId,
      startDate,
      endDate,
      h_f_day,
      reason,
      leavetype,
      status: "Pending",
    };
  } catch (err) {
    console.error(
      "Error updating leave request:",
      err && err.message ? err.message : err,
    );
    throw new Error("Failed to update leave request.");
  }
};

const cancelLeaveRequest = async (leaveId, employeeId, orgId) => {
  if (!orgId) throw new Error("orgId required");
  try {
    const tenantPool = await getTenantPool(orgId);
    const [existingLeaveRows] = await tenantPool.execute(
      queries.GET_LEAVE_BY_ID,
      [leaveId, employeeId],
    );
    if (!existingLeaveRows || existingLeaveRows.length === 0)
      throw new Error("Leave request not found or not accessible.");
    if (existingLeaveRows[0].status !== "pending")
      throw new Error("Only pending leave requests can be canceled.");
    const [result] = await tenantPool.execute(queries.DELETE_LEAVE_REQUEST, [
      leaveId,
      employeeId,
    ]);
    if (result.affectedRows === 0)
      throw new Error("Failed to cancel leave request.");
    return "Leave request successfully canceled.";
  } catch (err) {
    console.error(
      "Error canceling leave request:",
      err && err.message ? err.message : err,
    );
    throw new Error("Failed to cancel leave request.");
  }
};

const constructWhereClause = (
  filters = {},
  employeeIds = [],
  tableAlias = "lq",
) => {
  const { status, search, from_date, to_date } = filters || {};
  const whereConditions = [];
  const params = [];
  if (status) {
    whereConditions.push(`${tableAlias}.status = ?`);
    params.push(status);
  }
  if (search) {
    whereConditions.push(
      `(${tableAlias}.employee_id LIKE ? OR ${tableAlias}.reason LIKE ? OR CONCAT(e.first_name, ' ', e.last_name) LIKE ?)`,
    );
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (from_date) {
    whereConditions.push(`${tableAlias}.start_date >= ?`);
    params.push(from_date);
  }
  if (to_date) {
    whereConditions.push(`${tableAlias}.end_date <= ?`);
    params.push(to_date);
  }
  if (Array.isArray(employeeIds)) {
    if (employeeIds.length > 0) {
      whereConditions.push(
        `${tableAlias}.employee_id IN (${employeeIds.map(() => "?").join(", ")})`,
      );
      params.push(...employeeIds);
    } else if (employeeIds.length === 0) whereConditions.push("1=0");
  }
  return { whereConditions, params };
};

const getLeaveQueriesForTeamLead = async (filters = {}, teamLeadId, orgId) => {
  if (!orgId) throw new Error("orgId required");
  try {
    const tenantPool = await getTenantPool(orgId);

    const [profRows] = await tenantPool.execute(queries.GET_EMP_PROF_BY_ID, [
      teamLeadId,
    ]);
    if (!profRows || profRows.length === 0)
      throw new Error("Team lead professional profile not found.");
    const prof = profRows[0];
    const roleName = (prof.role || "").toString().trim().toLowerCase();
    const supervisorOrAbove = new Set([
      "supervisor",
      "manager",
      "admin",
      "ceo",
      "super admin",
    ]);
    const managerOrAbove = new Set(["manager", "admin", "ceo", "super admin"]);
    const employeeIdSet = new Set();
    if (supervisorOrAbove.has(roleName)) {
      const [directRows] = await tenantPool.execute(
        queries.GET_EMPLOYEES_BY_SUPERVISOR,
        [teamLeadId],
      );
      (directRows || []).forEach((r) => {
        if (r && r.employee_id) employeeIdSet.add(r.employee_id);
      });
    }
    if (managerOrAbove.has(roleName) && prof.department_id) {
      try {
        const [deptRows] = await tenantPool.execute(
          queries.GET_EMPLOYEES_BY_DEPARTMENT,
          [prof.department_id],
        );
        (deptRows || []).forEach((r) => {
          if (r && r.employee_id) employeeIdSet.add(r.employee_id);
        });
      } catch (err) {
        console.warn("Warning: failed to fetch department employees:", err);
      }
    }
    const employeeIds = Array.from(employeeIdSet);
    const { whereConditions, params } = constructWhereClause(
      filters,
      employeeIds,
      "lq",
    );

    // ensure tenant filter
    let query = queries.GET_LEAVE_QUERIES_FOR_TEAM;
    const tenantFilter = " lq.org_id = ? ";
    const tenantIndexInsertPos = query.toUpperCase().indexOf("WHERE");
    if (tenantIndexInsertPos !== -1) {
      query = query.replace(/WHERE/i, `WHERE ${tenantFilter} AND `);
    } else {
      query += ` WHERE ${tenantFilter}`;
    }
    const finalParams = [orgId].concat(params);

    const finalQuery =
      query +
      (whereConditions.length ? " AND " + whereConditions.join(" AND ") : "");

    const [rows] = await tenantPool.execute(finalQuery, finalParams);

    rows.forEach((row) => {
      row.start_date = toLocalDateString(row.start_date);
      row.end_date = toLocalDateString(row.end_date);
    });
    return rows;
  } catch (err) {
    console.error("Error fetching leave queries for team lead:", err);
    throw new Error("Failed to fetch leave queries for team lead.");
  }
};

/**
 * Insert attachment rows for a leave (append).
 * files: array of multer file objects (each has originalname, filename, path, mimetype, size)
 * Returns array of inserted metadata objects.
 */
async function saveLeaveAttachments(leaveId, files = [], orgId) {
  if (!leaveId) throw new Error("leaveId required");
  if (!Array.isArray(files) || files.length === 0) return [];
  if (!orgId) throw new Error("orgId required");

  const tenantPool = await getTenantPool(orgId);
  const inserted = [];

  for (const file of files) {
    try {
      // multer provides: file.originalname, file.filename, file.path, file.mimetype, file.size
      const fileName = file.originalname || file.filename || "file";
      const filePath = file.path || file.filename || "";
      const mime = file.mimetype || null;
      const size = Number(file.size || 0);

      const [result] = await tenantPool.execute(
        queries.INSERT_LEAVE_ATTACHMENT,
        [leaveId, fileName, filePath, mime, size, orgId],
      );

      inserted.push({
        id: result && result.insertId ? Number(result.insertId) : null,
        file_name: fileName,
        file_path: filePath,
        mime_type: mime,
        size,
      });
    } catch (err) {
      console.warn(
        "[saveLeaveAttachments] failed to insert attachment record for file:",
        file && file.originalname,
        err && err.message ? err.message : err,
      );
      // continue with other files
    }
  }

  return inserted;
}

/**
 * Get attachments for a leave
 *
 * Behavior:
 * - Attempts to fetch by leave_id + org_id first.
 * - If that returns nothing, performs a fallback fetch by leave_id only (covers rows with NULL/missing org_id).
 * - Returns metadata objects including `url` (if FILE_BASE_URL provided) and `exists` (best-effort check).
 */
async function getAttachmentsForLeave(leaveId, orgId) {
  if (!leaveId) throw new Error("leaveId required");
  if (!orgId) throw new Error("orgId required"); // handler should pass this; keep strict but tolerant in query

  const tenantPool = await getTenantPool(orgId);

  let rows = [];
  try {
    const [r] = await tenantPool.execute(queries.GET_ATTACHMENTS_BY_LEAVE, [
      leaveId,
      orgId,
    ]);
    rows = r || [];
  } catch (err) {
    console.warn(
      "[getAttachmentsForLeave] primary query failed, will attempt fallback. Error:",
      err && err.message ? err.message : err,
    );
    rows = [];
  }

  // fallback: if no rows returned, try fetching by leave_id only (covers org_id NULL or mismatched metadata)
  if (!rows || rows.length === 0) {
    try {
      const fallbackSql = `
        SELECT id, leave_id, file_name, file_path, mime_type, size,
               DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at, org_id
        FROM leave_attachments
        WHERE leave_id = ?
        ORDER BY created_at ASC
      `;
      const [fb] = await tenantPool.execute(fallbackSql, [leaveId]);
      rows = fb || [];
      if (rows && rows.length > 0) {
        console.info(
          `[getAttachmentsForLeave] fallback returned ${rows.length} rows for leaveId=${leaveId} (orgId=${orgId})`,
        );
      }
    } catch (fbErr) {
      console.warn(
        "[getAttachmentsForLeave] fallback query failed:",
        fbErr && fbErr.message ? fbErr.message : fbErr,
      );
    }
  }

  // Map rows: normalize fields and build url/exists flags (best-effort)
  const mapped = (rows || []).map((r) => {
    const filePath = r.file_path || "";
    // Build a public URL if configured. Prefer r.url if present.
    let url = r.url || null;
    if (!url && filePath) {
      if (/^https?:\/\//i.test(filePath)) {
        url = filePath;
      } else if (FILE_BASE_URL) {
        // ensure no double slashes
        url = `${FILE_BASE_URL.replace(/\/+$/, "")}/${String(filePath).replace(/^\/+/, "")}`;
      } else {
        url = null;
      }
    }

    // best-effort exists: only check when path plausibly points to local filesystem
    let exists = false;
    try {
      // consider it local if it contains uploads/leave_attachments or is absolute path
      const looksLocal =
        path.isAbsolute(filePath) ||
        String(filePath).includes(path.join("uploads", "leave_attachments")) ||
        String(filePath).startsWith(".");
      if (looksLocal && filePath) {
        const abs = path.isAbsolute(filePath)
          ? filePath
          : path.join(process.cwd(), filePath);
        exists = fs.existsSync(abs);
      } else {
        exists = false;
      }
    } catch (e) {
      exists = false;
    }

    return {
      id: Number(r.id),
      leave_id: r.leave_id,
      file_name: r.file_name,
      file_path: r.file_path,
      mime_type: r.mime_type,
      size: Number(r.size || 0),
      created_at: r.created_at,
      org_id: r.org_id,
      url,
      exists,
    };
  });

  return mapped;
}

/**
 * Get single attachment by id
 */
async function getAttachmentById(attachmentId, orgId) {
  if (!attachmentId) throw new Error("attachmentId required");
  if (!orgId) throw new Error("orgId required");
  const tenantPool = await getTenantPool(orgId);
  const [rows] = await tenantPool.execute(queries.GET_ATTACHMENT_BY_ID, [
    attachmentId,
    orgId,
  ]);
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  return {
    id: Number(r.id),
    leave_id: r.leave_id,
    file_name: r.file_name,
    file_path: r.file_path,
    mime_type: r.mime_type,
    size: Number(r.size || 0),
    created_at: r.created_at,
  };
}

/**
 * Delete an attachment row + unlink the physical file (best-effort).
 * Returns true if DB deletion succeeded (even if unlink failed).
 */
async function deleteAttachmentById(attachmentId, orgId) {
  if (!attachmentId) throw new Error("attachmentId required");
  if (!orgId) throw new Error("orgId required");

  const tenantPool = await getTenantPool(orgId);

  // fetch record first (to get path)
  const [rows] = await tenantPool.execute(queries.GET_ATTACHMENT_BY_ID, [
    attachmentId,
    orgId,
  ]);
  if (!rows || rows.length === 0) {
    // nothing to delete
    return false;
  }
  const rec = rows[0];
  const filePath = rec.file_path;

  // delete db record
  await tenantPool.execute(queries.DELETE_ATTACHMENT_BY_ID, [
    attachmentId,
    orgId,
  ]);

  // unlink filesystem - be safe: only unlink if path contains uploads/leave_attachments/<orgId> to avoid accidental deletes
  try {
    if (typeof filePath === "string" && filePath.length > 0) {
      const safeSegment = path.join(
        "uploads",
        "leave_attachments",
        String(orgId),
      );
      const abs = path.isAbsolute(filePath)
        ? filePath
        : path.join(process.cwd(), filePath);

      // allow unlink only if the abs path contains the expected safeSegment
      const normalizedAbs = path.normalize(abs);
      if (normalizedAbs.includes(path.normalize(safeSegment))) {
        try {
          if (fs.existsSync(normalizedAbs)) {
            fs.unlinkSync(normalizedAbs);
          }
        } catch (unlinkErr) {
          console.warn(
            "[deleteAttachmentById] failed to unlink file:",
            normalizedAbs,
            unlinkErr && unlinkErr.message ? unlinkErr.message : unlinkErr,
          );
        }
      } else {
        console.warn(
          "[deleteAttachmentById] refusing to unlink file outside uploads folder:",
          normalizedAbs,
        );
      }
    }
  } catch (err) {
    console.warn(
      "[deleteAttachmentById] unlink safety check failed:",
      err && err.message ? err.message : err,
    );
  }

  return true;
}

/**
 * Replace attachments for a leave:
 * - delete existing attachment rows (and attempt to unlink files)
 * - insert new files (saved by multer) as new rows
 *
 * Behavior: wrapped with DB transaction for DB changes. Files are unlinked best-effort.
 *
 * Returns: { deleted: [ids], inserted: [insertedMeta] }
 */
async function replaceAttachmentsForLeave(leaveId, files = [], orgId) {
  if (!leaveId) throw new Error("leaveId required");
  if (!orgId) throw new Error("orgId required");
  const tenantPool = await getTenantPool(orgId);

  // fetch existing attachments (to unlink later)
  // Use the service function (with fallback) rather than a direct query to ensure we pick up rows with NULL org_id too
  const existing = await getAttachmentsForLeave(leaveId, orgId);

  // start transaction
  const conn = await tenantPool.getConnection();
  try {
    await conn.beginTransaction();

    // delete records for this leave
    const idsToDelete = existing.map((r) => Number(r.id)).filter(Boolean);
    if (idsToDelete.length > 0) {
      // build placeholders
      const placeholders = idsToDelete.map(() => "?").join(",");
      // we use a safe delete that includes org_id in WHERE to avoid cross-tenant issues
      const deleteSql = `DELETE FROM leave_attachments WHERE id IN (${placeholders}) AND org_id = ?`;
      await conn.execute(deleteSql, [...idsToDelete, orgId]);
    }

    // insert new files
    const inserted = [];
    for (const file of files) {
      try {
        const fileName = file.originalname || file.filename || "file";
        const filePath = file.path || file.filename || "";
        const mime = file.mimetype || null;
        const size = Number(file.size || 0);

        const [res] = await conn.execute(queries.INSERT_LEAVE_ATTACHMENT, [
          leaveId,
          fileName,
          filePath,
          mime,
          size,
          orgId,
        ]);
        inserted.push({
          id: res && res.insertId ? Number(res.insertId) : null,
          file_name: fileName,
          file_path: filePath,
          mime_type: mime,
          size,
        });
      } catch (insErr) {
        console.warn(
          "[replaceAttachmentsForLeave] failed to insert a new attachment:",
          insErr && insErr.message ? insErr.message : insErr,
        );
        // bubble to outer catch to rollback
        throw insErr;
      }
    }

    await conn.commit();
    try {
      conn.release();
    } catch (e) {}

    // best-effort unlink of old files (after commit)
    for (const r of existing) {
      try {
        const filePath = r.file_path;
        if (!filePath) continue;
        const abs = path.isAbsolute(filePath)
          ? filePath
          : path.join(process.cwd(), filePath);
        const safeSegment = path.join(
          "uploads",
          "leave_attachments",
          String(orgId),
        );
        const normalizedAbs = path.normalize(abs);
        if (normalizedAbs.includes(path.normalize(safeSegment))) {
          if (fs.existsSync(normalizedAbs)) {
            try {
              fs.unlinkSync(normalizedAbs);
            } catch (uErr) {
              console.warn(
                "[replaceAttachmentsForLeave] unlink old file failed:",
                normalizedAbs,
                uErr && uErr.message ? uErr.message : uErr,
              );
            }
          }
        } else {
          console.warn(
            "[replaceAttachmentsForLeave] skipping unlink, path not in safe folder:",
            abs,
          );
        }
      } catch (innerErr) {
        console.warn(
          "[replaceAttachmentsForLeave] unlink loop error:",
          innerErr && innerErr.message ? innerErr.message : innerErr,
        );
      }
    }

    return { deleted: existing.map((r) => Number(r.id)), inserted };
  } catch (err) {
    // rollback DB changes on error
    try {
      await conn.rollback();
    } catch (rbErr) {
      console.error(
        "[replaceAttachmentsForLeave] rollback failed:",
        rbErr && rbErr.message ? rbErr.message : rbErr,
      );
    } finally {
      try {
        conn.release();
      } catch (e) {}
    }
    throw err;
  }
}

module.exports = {
  getLeaveQueries,
  updateLeaveRequest,
  submitLeaveRequest,
  getLeaveRequests,
  editLeaveRequest,
  cancelLeaveRequest,
  getLeaveQueriesForTeamLead,
  getLeaveTypes,
  getLeaveTypeByKey,
  saveLeaveAttachments,
  getAttachmentsForLeave,
  getAttachmentById,
  deleteAttachmentById,
  replaceAttachmentsForLeave,
  getEmployeePersonal,
  validateLeaveTypeEligibility,
  getEmployeeProfile,
};
