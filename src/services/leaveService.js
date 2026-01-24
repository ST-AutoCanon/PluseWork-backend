// services/leaveService.js
const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const queries = require("../constants/leaveQueries");
const LeavePolicyService = require("./leavePolicyService");

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
  getEmployeePersonal,
  validateLeaveTypeEligibility,
  getEmployeeProfile,
};

