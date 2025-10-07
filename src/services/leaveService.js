// src/services/leaveService.js
const db = require("../config");
const queries = require("../constants/leaveQueries");
const LeavePolicyService = require("./leavePolicyService");

/* ---------- helpers ---------- */
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

/* ---------- read helpers ---------- */
const getLeaveQueries = async (filters = {}) => {
  const { status, search, from_date, to_date, org_id } = filters;

  try {
    if (!org_id) {
      throw new Error("org_id is required in request headers");
    }

    let query = queries.GET_LEAVE_QUERIES;
    const params = [];
    const whereConditions = [];

    // Always filter by organization
    query += ` AND lq.org_id = ?`;
    params.push(org_id); // first param corresponds to the org_id placeholder

    if (status) {
      whereConditions.push("lq.status = ?");
      params.push(status);
    }
    if (search) {
      whereConditions.push(
        `(lq.employee_id LIKE ? OR lq.reason LIKE ? OR CONCAT(e.first_name, ' ', e.last_name) LIKE ?)`
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

    console.log("Executing SQL:", query, params);
    const [rows] = await db.execute(query, params);
    rows.forEach((r) => {
      r.start_date = toLocalDateString(r.start_date);
      r.end_date = toLocalDateString(r.end_date);
    });
    return rows;
  } catch (err) {
    console.error(
      "Error fetching leave queries:",
      err && err.message ? err.message : err
    );
    throw new Error("Failed to fetch leave queries.");
  }
};

/* ---------- updateLeaveRequest (transactional) ---------- */
const updateLeaveRequest = async (payload) => {
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
    // new flag — expected from frontend when using default fallback
    is_defaulted = false,
  } = payload;

  const bind = (v) => (v === undefined ? null : v);

  let conn = null;
  let transactionStarted = false;
  try {
    console.log("[updateLeaveRequest] called with payload:", payload);

    // Load leave (pool non-transactional read)
    console.log("[updateLeaveRequest] executing GET_LEAVE_BY_LEAVEID", [
      leaveId,
    ]);
    const [leaveRows] = await db.execute(queries.GET_LEAVE_BY_LEAVEID, [
      leaveId,
    ]);
    if (!leaveRows || leaveRows.length === 0) {
      const err = new Error("Leave request not found.");
      err.isBadRequest = true;
      throw err;
    }
    const leave = leaveRows[0];
    console.log("[updateLeaveRequest] loaded leave:", leave);

    const currentStatus = (leave.status || "").toLowerCase();
    if (currentStatus && currentStatus !== "pending") {
      const err = new Error(
        "Leave request cannot be modified after it has been processed."
      );
      err.isBadRequest = true;
      throw err;
    }

    // validate totals
    const computedTotalDays = computeInclusiveDays(
      leave.start_date,
      leave.end_date,
      leave.H_F_day
    );
    console.log("[updateLeaveRequest] computedTotalDays:", computedTotalDays);
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
          `Client total_days (${totalDays}) does not match server computed days (${computedTotalDays}).`
        );
        err.isBadRequest = true;
        throw err;
      }
    } else {
      totalDays = computedTotalDays;
    }

    // read remaining balance (non-transactional)
    let remaining = 0;
    try {
      console.log("[updateLeaveRequest] selecting remaining balance", [
        leave.employee_id,
        leave.leave_type,
      ]);
      const [balRows] = await db.execute(
        `SELECT remaining FROM employee_leave_balances WHERE employee_id = ? AND leave_type = ? LIMIT 1`,
        [leave.employee_id, leave.leave_type]
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
    console.log("[updateLeaveRequest] remaining balance:", remaining);

    // Approved branch: do all writes in a transaction
    if (status === "Approved") {
      const c = Number(compensated_days) || 0;
      const d = Number(deducted_days) || 0;
      const l = Number(loss_of_pay_days) || 0;
      console.log("[updateLeaveRequest] incoming splits", {
        compensated: c,
        deducted: d,
        lop: l,
      });

      if (Math.abs(c + d + l - totalDays) > EPS) {
        const err = new Error(
          `Split values must add up to total requested days (${totalDays}). Received: compensated=${c}, deducted=${d}, loss_of_pay=${l}.`
        );
        err.isBadRequest = true;
        throw err;
      }

      // acquire a dedicated connection for transaction
      conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        transactionStarted = true;
      } catch (e) {
        // if beginTransaction fails, release connection and rethrow
        try {
          conn.release();
        } catch (_) {}
        throw e;
      }

      try {
        // prepare write values
        const c_write = Number(c.toFixed(2));
        const d_write = Number(d.toFixed(2));
        // if is_defaulted -> do NOT write the LoP into leavequeries.loss_of_pay_days (write zero)
        const l_write = Number(l.toFixed(2));
        const preserved_write =
          preserved_leave_days === null
            ? null
            : Number(Number(preserved_leave_days).toFixed(2));
        const isDefaultFlagNum = is_defaulted ? 1 : 0;

        // UPDATE leave row (order must match query)
        const paramsUpdateLeave = [
          bind(status),
          bind(comments),
          bind(c_write),
          bind(d_write),
          // if is_defaulted -> write zero to loss_of_pay_days; otherwise write actual l_write
          bind(isDefaultFlagNum ? 0 : l_write),
          bind(preserved_write),
          bind(isDefaultFlagNum),
          bind(leaveId),
        ];
        console.log(
          "[updateLeaveRequest] executing UPDATE_LEAVE_STATUS_EXTENDED with params:",
          paramsUpdateLeave
        );
        await conn.execute(
          queries.UPDATE_LEAVE_STATUS_EXTENDED,
          paramsUpdateLeave
        );

        // adjust leave balance if there are deducted days
        if (d_write > EPS) {
          try {
            console.log("[updateLeaveRequest] executing ADJUST_LEAVE_BALANCE", [
              d_write,
              leave.employee_id,
              leave.leave_type,
            ]);
            await conn.execute(queries.ADJUST_LEAVE_BALANCE, [
              d_write,
              leave.employee_id,
              leave.leave_type,
            ]);
          } catch (err) {
            if (err && err.code === "ER_NO_SUCH_TABLE") {
              console.warn(
                "employee_leave_balances missing — skipping adjust."
              );
            } else {
              throw err;
            }
          }
        }

        // Insert LoP record — only if actual LoP > 0 AND not defaulted.
        if (!isDefaultFlagNum && l_write > EPS) {
          console.log("[updateLeaveRequest] executing INSERT_LOP_RECORD", [
            leave.employee_id,
            leaveId,
            l_write,
            `LoP for leave ${leaveId}`,
          ]);
          await conn.execute(queries.INSERT_LOP_RECORD, [
            leave.employee_id,
            leaveId,
            l_write,
            `LoP for leave ${leaveId}`,
          ]);
        } else {
          console.log(
            "[updateLeaveRequest] skipping INSERT_LOP_RECORD because is_defaulted =",
            isDefaultFlagNum,
            "or l_write =",
            l_write
          );
        }

        // Insert audit. If audit table missing -> non-fatal warning.
        try {
          const auditPayload = {
            compensated_days: c_write,
            deducted_days: d_write,
            loss_of_pay_days: isDefaultFlagNum ? 0 : l_write,
            preserved_leave_days: preserved_write,
            is_defaulted: Boolean(isDefaultFlagNum),
          };
          const auditDetails = JSON.stringify(auditPayload);
          console.log("[updateLeaveRequest] executing INSERT_LEAVE_AUDIT", [
            leaveId,
            actorId || "system",
            `update:${status}`,
            auditDetails,
          ]);
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
            // Unexpected audit failure should cause rollback
            console.error(
              "[updateLeaveRequest] audit insert failed (fatal):",
              auditErr && auditErr.message ? auditErr.message : auditErr
            );
            throw auditErr;
          }
        }

        // commit
        await conn.commit();
        console.log("[updateLeaveRequest] transaction committed successfully");
      } catch (txErr) {
        console.error(
          "[updateLeaveRequest] transaction error, attempting rollback:",
          txErr && txErr.message ? txErr.message : txErr
        );
        try {
          if (transactionStarted && conn) {
            await conn.rollback();
            console.log("[updateLeaveRequest] rollback successful");
          }
        } catch (rbErr) {
          console.error(
            "[updateLeaveRequest] rollback failed:",
            rbErr && rbErr.message ? rbErr.message : rbErr
          );
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
            releaseErr && releaseErr.message ? releaseErr.message : releaseErr
          );
        }
      }

      // recompute monthly LOP outside transaction (best-effort)
      try {
        const leaveStart = parseDateOnly(leave.start_date);
        const leaveEnd = parseDateOnly(leave.end_date);
        if (leaveStart && leaveEnd) {
          const cursor = new Date(
            leaveStart.getFullYear(),
            leaveStart.getMonth(),
            1
          );
          const endCursor = new Date(
            leaveEnd.getFullYear(),
            leaveEnd.getMonth(),
            1
          );
          while (cursor <= endCursor) {
            const month = cursor.getMonth() + 1;
            const year = cursor.getFullYear();
            try {
              console.log(
                `[updateLeaveRequest] recomputing monthly LOP for ${leave.employee_id} for ${month}-${year}`
              );
              await LeavePolicyService.computeAndStoreMonthlyLOP(
                leave.employee_id,
                month,
                year
              );
            } catch (recomputeErr) {
              console.warn(
                `[updateLeaveRequest] Warning: failed to recompute monthly LOP for ${leave.employee_id} ${month}-${year}:`,
                recomputeErr && recomputeErr.message
                  ? recomputeErr.message
                  : recomputeErr
              );
            }
            cursor.setMonth(cursor.getMonth() + 1);
          }
        } else {
          console.warn(
            "[updateLeaveRequest] Could not parse leave start/end for LOP recompute."
          );
        }
      } catch (err) {
        console.warn(
          "[updateLeaveRequest] Unexpected error when recomputing monthly LOP:",
          err && err.message ? err.message : err
        );
      }

      return;
    } else {
      // Rejection or other non-Approved: update non-transactionally
      // Use the incoming is_defaulted flag so DB accurately reflects what frontend sent.
      const isDefaultFlagNum = is_defaulted ? 1 : 0;

      const paramsReject = [
        bind(status),
        bind(comments),
        bind(0), // compensated
        bind(0), // deducted
        bind(0), // loss_of_pay - rejected path sets 0
        bind(preserved_leave_days),
        // is_defaulted as provided by caller (was previously hardcoded to 0)
        bind(isDefaultFlagNum),
        bind(leaveId),
      ];
      console.log(
        "[updateLeaveRequest] executing UPDATE_LEAVE_STATUS_EXTENDED (non-approved) with params:",
        paramsReject
      );
      await db.execute(queries.UPDATE_LEAVE_STATUS_EXTENDED, paramsReject);
      return;
    }
  } catch (err) {
    console.error(
      "Error in LeaveService.updateLeaveRequest:",
      err && err.message ? err.message : err
    );
    throw err;
  } finally {
    // final defensive release if something left open
    try {
      if (conn) {
        // if transaction still open try to rollback
        try {
          if (transactionStarted) {
            await conn.rollback();
            transactionStarted = false;
          }
        } catch (rb) {
          // ignore
        }
        try {
          conn.release();
        } catch (releaseErr) {
          // ignore
        }
      }
    } catch (e) {
      // ignore final release failures
    }
  }
};

/* ---------- remaining functions (unchanged) ---------- */

const submitLeaveRequest = async ({
  employeeId,
  startDate,
  endDate,
  h_f_day,
  reason,
  leavetype,
}) => {
  try {
    const existingLeaves = await getLeaveRequests(employeeId);
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
        "You already have a leave request on the selected date(s)."
      );
    const [result] = await db.execute(queries.INSERT_LEAVE_REQUEST, [
      employeeId,
      startDate,
      endDate,
      h_f_day,
      reason,
      leavetype,
    ]);
    return {
      id: result.insertId,
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
      err && err.message ? err.message : err
    );
    throw new Error("Failed to submit leave request.");
  }
};

const getLeaveRequests = async (
  employeeId,
  from_date = null,
  to_date = null
) => {
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
      baseQuery
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
    let finalQuery = baseQuery;
    if (filterConditions.length)
      finalQuery +=
        (hasWhere ? " AND " : " WHERE ") + filterConditions.join(" AND ");
    if (!/\border\s+by\b/i.test(finalQuery))
      finalQuery += " ORDER BY lq.created_at DESC";
    const finalParams = initialParams.concat(filterParams);
    console.log("[getLeaveRequests] SQL:", finalQuery, "params:", finalParams);
    const [rows] = await db.execute(finalQuery, finalParams);
    rows.forEach((row) => {
      row.start_date = toLocalDateString(row.start_date);
      row.end_date = toLocalDateString(row.end_date);
    });
    return rows;
  } catch (err) {
    console.error(
      "Error retrieving leave requests:",
      err && err.message ? err.message : err
    );
    throw new Error("Failed to retrieve leave requests.");
  }
};

const editLeaveRequest = async ({
  leaveId,
  employeeId,
  startDate,
  endDate,
  h_f_day,
  reason,
  leavetype,
}) => {
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
    const [existingLeave] = await db.execute(queries.GET_LEAVE_BY_ID, [
      leaveId,
      employeeId,
    ]);
    if (existingLeave.length === 0)
      throw new Error("Leave request not found or not accessible.");
    if (existingLeave[0].status !== "pending")
      throw new Error(
        "Leave request cannot be edited after approval or rejection."
      );
    const [result] = await db.execute(queries.UPDATE_LEAVE_REQUEST, [
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
      err && err.message ? err.message : err
    );
    throw new Error("Failed to update leave request.");
  }
};

const cancelLeaveRequest = async (leaveId, employeeId) => {
  try {
    const [existingLeave] = await db.execute(queries.GET_LEAVE_BY_ID, [
      leaveId,
      employeeId,
    ]);
    if (existingLeave.length === 0)
      throw new Error("Leave request not found or not accessible.");
    if (existingLeave[0].status !== "pending")
      throw new Error("Only pending leave requests can be canceled.");
    const [result] = await db.execute(queries.DELETE_LEAVE_REQUEST, [
      leaveId,
      employeeId,
    ]);
    if (result.affectedRows === 0)
      throw new Error("Failed to cancel leave request.");
    return "Leave request successfully canceled.";
  } catch (err) {
    console.error(
      "Error canceling leave request:",
      err && err.message ? err.message : err
    );
    throw new Error("Failed to cancel leave request.");
  }
};

const constructWhereClause = (
  filters = {},
  employeeIds = [],
  tableAlias = "lq"
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
      `(${tableAlias}.employee_id LIKE ? OR ${tableAlias}.reason LIKE ? OR CONCAT(e.first_name, ' ', e.last_name) LIKE ?)`
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
        `${tableAlias}.employee_id IN (${employeeIds
          .map(() => "?")
          .join(", ")})`
      );
      params.push(...employeeIds);
    } else if (employeeIds.length === 0) whereConditions.push("1=0");
  }
  return { whereConditions, params };
};

const getLeaveQueriesForTeamLead = async (filters = {}, teamLeadId) => {
  try {
    const [profRows] = await db.execute(queries.GET_EMP_PROF_BY_ID, [
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
      const [directRows] = await db.execute(
        queries.GET_EMPLOYEES_BY_SUPERVISOR,
        [teamLeadId]
      );
      (directRows || []).forEach((r) => {
        if (r && r.employee_id) employeeIdSet.add(r.employee_id);
      });
    }
    if (managerOrAbove.has(roleName) && prof.department_id) {
      try {
        const [deptRows] = await db.execute(
          queries.GET_EMPLOYEES_BY_DEPARTMENT,
          [prof.department_id]
        );
        (deptRows || []).forEach((r) => {
          if (r && r.employee_id) employeeIdSet.add(r.employee_id);
        });
      } catch (err) {
        console.warn(
          "Warning: failed to fetch department employees:",
          err && err.message ? err.message : err
        );
      }
    }
    const employeeIds = Array.from(employeeIdSet);
    const { whereConditions, params } = constructWhereClause(
      filters,
      employeeIds,
      "lq"
    );
    const query =
      queries.GET_LEAVE_QUERIES_FOR_TEAM +
      (whereConditions.length ? " AND " + whereConditions.join(" AND ") : "");
    console.log("[getLeaveQueriesForTeamLead] SQL:", query, "params:", params);
    const [rows] = await db.execute(query, params);
    rows.forEach((row) => {
      row.start_date = toLocalDateString(row.start_date);
      row.end_date = toLocalDateString(row.end_date);
    });
    return rows;
  } catch (err) {
    console.error(
      "Error fetching leave queries for team lead:",
      err && err.message ? err.message : err
    );
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
};
