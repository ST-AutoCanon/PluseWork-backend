// src/services/leavePolicyService.js
const db = require("../config");
const queries = require("../constants/leavePolicyQueries");
const dayjs = require("dayjs");

/**
 * Safely parse JSON leave_settings column into Array.
 */
function safeParseSettings(raw) {
  if (!raw) return [];
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }
  return Array.isArray(raw) ? raw : [];
}

/**
 * Parse a date-like value into a local Date at midnight (no timezone shift).
 * Accepts Date, ISO strings, or 'YYYY-MM-DD' strings.
 * Returns null if invalid.
 */
function parseLocalDate(dateInput) {
  if (!dateInput && dateInput !== 0) return null;
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    return new Date(
      dateInput.getFullYear(),
      dateInput.getMonth(),
      dateInput.getDate()
    );
  }
  const s = String(dateInput).trim();
  // YYYY-MM-DD common case
  const parts = s.split("-");
  if (parts.length === 3 && /^[0-9]{4}$/.test(parts[0])) {
    const [y, m, d] = parts;
    const Y = Number(y),
      M = Number(m) - 1,
      D = Number(d);
    if (!Number.isNaN(Y) && !Number.isNaN(M) && !Number.isNaN(D)) {
      return new Date(Y, M, D);
    }
  }
  // fallback to Date constructor (may parse ISO)
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }
  return null;
}

/* ------------------ helpers for leave balances / LOP (unchanged logic) ------------------ */

async function getEmployeeCarryForwards(employeeId, year) {
  if (!employeeId) return {};
  try {
    const [rows] = await db.execute(queries.GET_EMPLOYEE_CARRY_FORWARD, [
      employeeId,
      year,
    ]);
    const map = {};
    (rows || []).forEach((r) => {
      if (!r || r.leave_type == null) return;
      map[String(r.leave_type).trim().toLowerCase()] = Number(r.amount || 0);
    });
    return map;
  } catch (err) {
    console.error("getEmployeeCarryForwards error:", err);
    return {};
  }
}

const getAllPolicies = async () => {
  const [rows] = await db.execute(queries.getAll);
  return (rows || []).map((r) => ({
    ...r,
    leave_settings: safeParseSettings(r.leave_settings),
  }));
};

const createPolicy = async ({
  period,
  year_start,
  year_end,
  leave_settings,
}) => {
  const [result] = await db.execute(queries.create, [
    period,
    year_start,
    year_end,
    JSON.stringify(leave_settings),
  ]);
  const [newRows] = await db.execute(queries.getById, [result.insertId]);
  const policy = newRows[0];
  if (policy) policy.leave_settings = safeParseSettings(policy.leave_settings);
  return policy;
};

const updatePolicy = async (
  id,
  { period, year_start, year_end, leave_settings }
) => {
  await db.execute(queries.update, [
    period,
    year_start,
    year_end,
    JSON.stringify(leave_settings),
    id,
  ]);
};

const deletePolicy = async (id) => {
  await db.execute(queries.remove, [id]);
};

/* ------------------ LOP / monthly helpers (kept same as your working code) ------------------ */

async function getWorkedDays(employeeId, periodStart, periodEnd) {
  const [rows] = await db.execute(queries.GET_WORKED_DAYS, [
    employeeId,
    periodStart,
    periodEnd,
  ]);
  return Number(rows[0]?.worked_days || 0);
}

const getUsedLeavesInPeriod = async (employeeId, periodStart, periodEnd) => {
  const params = [
    employeeId,
    periodStart,
    periodEnd,
    periodStart,
    periodEnd,
    periodStart,
    periodEnd,
  ];
  try {
    const [rows] = await db.execute(queries.GET_USED_LEAVES_IN_PERIOD, params);
    const map = {};
    (rows || []).forEach(
      (r) =>
        (map[
          String(r.leave_type || "")
            .trim()
            .toLowerCase()
        ] = Number(r.used || 0))
    );
    return map;
  } catch (err) {
    console.error(
      "getUsedLeavesInPeriod failed:",
      err && err.message ? err.message : err
    );
    return {};
  }
};

function computeEarnedLeavesFromWorked(
  workedDays,
  workingDaysRequired,
  earnedLeavesGrant
) {
  if (!workingDaysRequired || Number(workingDaysRequired) <= 0) return 0;
  if (!earnedLeavesGrant || Number(earnedLeavesGrant) <= 0) return 0;
  const ratio = Number(workedDays) / Number(workingDaysRequired);
  if (!isFinite(ratio) || ratio <= 0) return 0;
  return Number((ratio * Number(earnedLeavesGrant)).toFixed(1));
}

async function computeAndStoreMonthlyLOP(employeeId, month, year) {
  console.log(`[computeAndStoreMonthlyLOP] ${employeeId} ${month}-${year}`);
  if (!employeeId) throw new Error("employeeId required");
  const m = Number(month);
  const y = Number(year);
  if (!Number.isFinite(m) || m < 1 || m > 12 || !Number.isFinite(y))
    throw new Error("Invalid month/year");
  const periodStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const periodEnd = `${y}-${String(m).padStart(2, "0")}-${String(
    lastDay
  ).padStart(2, "0")}`;

  // explicit LOP
  const [lopRows] = await db.execute(
    `SELECT SUM(loss_of_pay_days) AS total_lop_days FROM leavequeries WHERE employee_id = ? AND status = 'Approved' AND start_date <= ? AND end_date >= ?`,
    [employeeId, periodEnd, periodStart]
  );
  const explicitLOP = Number(lopRows[0]?.total_lop_days || 0);
  if (explicitLOP > 0) {
    await db.execute(queries.UPSERT_EMPLOYEE_MONTHLY_LOP, [
      employeeId,
      m,
      y,
      explicitLOP,
    ]);
    return { month: m, year: y, total_lop: explicitLOP };
  }

  // fallback compute
  const policies = await getAllPolicies().catch((e) => {
    console.warn("getAllPolicies failed:", e);
    return [];
  });
  let active = null;
  if (Array.isArray(policies) && policies.length > 0) {
    active = policies.find(
      (p) =>
        new Date(p.year_start) <= new Date(periodEnd) &&
        new Date(p.year_end) >= new Date(periodStart)
    );
    if (!active)
      active = policies
        .slice()
        .sort((a, b) => new Date(b.year_start) - new Date(a.year_start))[0];
  }

  if (!active) {
    await db.execute(queries.UPSERT_EMPLOYEE_MONTHLY_LOP, [
      employeeId,
      m,
      y,
      0,
    ]);
    return { month: m, year: y, total_lop: 0 };
  }

  const usedByType = await getUsedLeavesInPeriod(
    employeeId,
    periodStart,
    periodEnd
  ).catch(() => ({}));
  const workedUntilMonthEnd = await getWorkedDays(
    employeeId,
    active.year_start,
    periodEnd
  ).catch(() => 0);
  const policyYear = new Date(active.year_start).getFullYear();
  const employeeCFMap = await getEmployeeCarryForwards(
    employeeId,
    policyYear
  ).catch(() => ({}));
  const settings = Array.isArray(active.leave_settings)
    ? active.leave_settings
    : safeParseSettings(active.leave_settings);

  let total_lop = 0;
  for (const setting of settings) {
    try {
      const typeKey = String(setting.type || "")
        .trim()
        .toLowerCase();
      const used = Number((usedByType && usedByType[typeKey]) || 0);
      const annualStatic = Number(setting.value || 0);
      const policyCarry = Number(setting.carry_forward || 0);
      const empCarry = employeeCFMap[typeKey];
      const carryForward =
        empCarry !== undefined
          ? Math.min(Number(empCarry || 0), policyCarry)
          : 0;
      const isEarned = typeKey === "earned";
      const monthlyStaticAllowance = isEarned
        ? 0
        : Math.floor(annualStatic / 12);

      let earnedUntilMonthEnd = 0;
      if (isEarned) {
        earnedUntilMonthEnd = computeEarnedLeavesFromWorked(
          workedUntilMonthEnd,
          Number(setting.working_days || 0),
          Number(setting.earned_leaves || 0)
        );
      }

      const allowance =
        monthlyStaticAllowance + earnedUntilMonthEnd + carryForward;
      const lopForType = Math.max(Number(used) - allowance, 0);
      total_lop += lopForType;
    } catch (e) {
      console.warn("computeAndStoreMonthlyLOP inner error:", e);
    }
  }

  total_lop = Number(total_lop.toFixed(2));
  await db.execute(queries.UPSERT_EMPLOYEE_MONTHLY_LOP, [
    employeeId,
    m,
    y,
    total_lop,
  ]);
  return { month: m, year: y, total_lop };
}

const getMonthlyLOP = async (employeeId, month, year) => {
  if (!employeeId) throw new Error("employeeId required");
  const m = Number(month),
    y = Number(year);
  const [rows] = await db.execute(queries.GET_EMPLOYEE_MONTHLY_LOP, [
    employeeId,
    m,
    y,
  ]);
  if (rows && rows[0])
    return {
      month: m,
      year: y,
      total_lop: Number(rows[0].lop || 0),
      computed_at: rows[0].computed_at,
    };
  return await computeAndStoreMonthlyLOP(employeeId, m, y);
};

const getLeaveBalance = async (employeeId) => {
  if (!employeeId) throw new Error("employeeId required");
  const policies = await getAllPolicies();
  if (!policies || policies.length === 0) return [];
  const active = policies
    .slice()
    .sort((a, b) => new Date(b.year_start) - new Date(a.year_start))[0];
  if (!active) return [];
  const now = new Date();
  const upToDate =
    now > new Date(active.year_end)
      ? active.year_end
      : now.toISOString().split("T")[0];
  const workedDays = await getWorkedDays(
    employeeId,
    active.year_start,
    upToDate
  );
  const usedMap = await getUsedLeavesInPeriod(
    employeeId,
    active.year_start,
    active.year_end
  );
  const policyYear = new Date(active.year_start).getFullYear();
  const employeeCFMap = await getEmployeeCarryForwards(employeeId, policyYear);
  const settings = Array.isArray(active.leave_settings)
    ? active.leave_settings
    : safeParseSettings(active.leave_settings);

  return settings.map((setting) => {
    const typeKey = String(setting.type || "")
      .trim()
      .toLowerCase();
    const used = Number(usedMap[typeKey] || 0);
    const policyCarryAllowed = Number(setting.carry_forward || 0);
    const employeeCarry = employeeCFMap[typeKey];
    const carryForward =
      employeeCarry !== undefined
        ? Math.min(Number(employeeCarry || 0), policyCarryAllowed)
        : 0;
    const annual = Number(setting.value || 0);
    const earnedFromAttendance =
      typeKey === "earned"
        ? computeEarnedLeavesFromWorked(
            workedDays,
            Number(setting.working_days || 0),
            Number(setting.earned_leaves || 0)
          )
        : 0;
    const allowance =
      (typeKey === "earned" ? earnedFromAttendance : annual) + carryForward;
    const remaining = Math.max(allowance - used, 0);
    const loss_of_pay = Math.max(used - allowance, 0);
    return {
      type: setting.type,
      enabled: !!setting.enabled,
      annual_allowance: annual,
      earned: earnedFromAttendance,
      carry_forward: carryForward,
      allowance,
      used,
      remaining,
      loss_of_pay,
    };
  });
};

/* ------------------ AUTO-EXTEND: primary function you need ------------------ */

/**
 * Auto-extend recently ended policies by adding `extensionDays` to year_end.
 * - extensionDays: days to add (default 90)
 * - actorId: to record in leave_audit actor_id
 *
 * Returns array of updated policy rows.
 */
async function autoExtendRecentPolicies(
  extensionDays = 90,
  actorId = "system"
) {
  const policies = await getAllPolicies();
  if (!Array.isArray(policies) || policies.length === 0) {
    console.log("[autoExtendRecentPolicies] no policies found");
    return [];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - Number(extensionDays || 90));

  console.log(
    `[autoExtendRecentPolicies] today=${today
      .toISOString()
      .slice(0, 10)} cutoff=${cutoff
      .toISOString()
      .slice(0, 10)} extensionDays=${extensionDays}`
  );

  const candidates = [];
  for (const p of policies) {
    const end = parseLocalDate(p.year_end);
    if (!end) {
      console.warn(
        "[autoExtendRecentPolicies] skipping policy with invalid year_end:",
        p
      );
      continue;
    }
    // Accept policies that ended on or before today, but not older than cutoff
    // (i.e. year_end <= today && year_end >= cutoff)
    const endedOnOrBeforeToday = end <= today;
    const newerThanCutoff = end >= cutoff;
    console.log(
      `[autoExtendRecentPolicies] policy id=${p.id} year_end=${
        p.year_end
      } parsed=${end
        .toISOString()
        .slice(
          0,
          10
        )} endedOnOrBeforeToday=${endedOnOrBeforeToday} newerThanCutoff=${newerThanCutoff}`
    );
    if (endedOnOrBeforeToday && newerThanCutoff) {
      candidates.push({ policy: p, end });
    }
  }

  if (candidates.length === 0) {
    console.log(
      "[autoExtendRecentPolicies] no policies to extend based on cutoff"
    );
    return [];
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const updated = [];

    for (const item of candidates) {
      const p = item.policy;
      const oldEnd = item.end;

      const newEnd = new Date(oldEnd);
      newEnd.setDate(newEnd.getDate() + Number(extensionDays || 90));

      const newEndStr = `${newEnd.getFullYear()}-${String(
        newEnd.getMonth() + 1
      ).padStart(2, "0")}-${String(newEnd.getDate()).padStart(2, "0")}`;

      // Update in-place
      await conn.execute(`UPDATE leave_policy SET year_end = ? WHERE id = ?`, [
        newEndStr,
        p.id,
      ]);

      // Prepare audit details
      const detailsObj = {
        action: "auto_extend_policy",
        extensionDays: Number(extensionDays || 90),
        policyId: p.id,
        oldYearEnd: `${oldEnd.getFullYear()}-${String(
          oldEnd.getMonth() + 1
        ).padStart(2, "0")}-${String(oldEnd.getDate()).padStart(2, "0")}`,
        newYearEnd: newEndStr,
      };
      const details = JSON.stringify(detailsObj);

      // Insert audit row. leave_id is policy-level, so pass NULL.
      // But if DB disallows NULL for leave_id, fallback to 0.
      try {
        await conn.execute(queries.INSERT_LEAVE_AUDIT, [
          null,
          actorId || "system",
          "policy_auto_extend",
          details,
        ]);
      } catch (auditErr) {
        console.warn(
          "[autoExtendRecentPolicies] failed to insert audit with leave_id=null, trying 0:",
          auditErr && auditErr.message ? auditErr.message : auditErr
        );
        try {
          await conn.execute(queries.INSERT_LEAVE_AUDIT, [
            0,
            actorId || "system",
            "policy_auto_extend",
            details,
          ]);
        } catch (auditErr2) {
          console.error(
            "[autoExtendRecentPolicies] failed to insert audit fallback (0):",
            auditErr2
          );
          // continue — do not abort entire operation for audit insertion failure
        }
      }

      // reload updated policy row
      const [rows] = await conn.execute(
        `SELECT id, period, DATE_FORMAT(year_start, '%Y-%m-%d') AS year_start, DATE_FORMAT(year_end, '%Y-%m-%d') AS year_end, leave_settings FROM leave_policy WHERE id = ?`,
        [p.id]
      );
      if (rows && rows[0]) {
        const row = rows[0];
        row.leave_settings = safeParseSettings(row.leave_settings);
        updated.push(row);
      }
    }

    await conn.commit();
    conn.release();
    console.log(
      `[autoExtendRecentPolicies] extended ${updated.length} policy(ies)`
    );
    return updated;
  } catch (err) {
    console.error("[autoExtendRecentPolicies] error, rolling back:", err);
    try {
      await conn.rollback();
      conn.release();
    } catch (e) {
      console.error("rollback error:", e);
    }
    throw err;
  }
}

module.exports = {
  getAllPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getLeaveBalance,
  getMonthlyLOP,
  computeAndStoreMonthlyLOP,
  getWorkedDays,
  getUsedLeavesInPeriod,
  computeEarnedLeavesFromWorked,
  getEmployeeCarryForwards,
  autoExtendRecentPolicies,
};
