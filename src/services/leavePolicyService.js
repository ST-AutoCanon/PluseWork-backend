// services/leavePolicyService.js
const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");
const queries = require("../constants/leavePolicyQueries");
const dayjs = require("dayjs");

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
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }
  return null;
}

async function getTenantPoolForOrgId(orgId) {
  if (!orgId) throw new Error("orgId required");
  // derive database name tenant_<org id>, then sanitize and obtain pool
  const dbName = sanitizeDbName(`tenant_${orgId}`);
  return getTenantPool(dbName);
}

/* Replace previous getTenantPool usage with getTenantPoolForOrgId */
async function getEmployeeCarryForwards(employeeId, year, orgId) {
  if (!employeeId) return {};
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [rows] = await tenantPool.execute(
      queries.GET_EMPLOYEE_CARRY_FORWARD,
      [employeeId, year]
    );
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

const getAllPolicies = async (orgId) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.execute(queries.getAll, [orgId]);
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
  orgId,
}) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [result] = await tenantPool.execute(queries.create, [
    orgId,
    period,
    year_start,
    year_end,
    JSON.stringify(leave_settings),
  ]);
  const [newRows] = await tenantPool.execute(queries.getById, [
    result.insertId,
  ]);
  const policy = newRows[0];
  if (policy) policy.leave_settings = safeParseSettings(policy.leave_settings);
  return policy;
};

const updatePolicy = async (
  id,
  orgId,
  { period, year_start, year_end, leave_settings }
) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  await tenantPool.execute(queries.update, [
    period,
    year_start,
    year_end,
    JSON.stringify(leave_settings),
    id,
    orgId,
  ]);
};

const deletePolicy = async (id, orgId) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  await tenantPool.execute(queries.remove, [id, orgId]);
};

async function getWorkedDays(employeeId, periodStart, periodEnd, orgId) {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.execute(queries.GET_WORKED_DAYS, [
    employeeId,
    periodStart,
    periodEnd,
  ]);
  return Number(rows[0]?.worked_days || 0);
}

const getUsedLeavesInPeriod = async (
  employeeId,
  periodStart,
  periodEnd,
  orgId
) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
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
    const [rows] = await tenantPool.execute(
      queries.GET_USED_LEAVES_IN_PERIOD,
      params
    );
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
    console.error("getUsedLeavesInPeriod failed:", err);
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

async function computeAndStoreMonthlyLOP(employeeId, month, year, orgId) {
  if (!employeeId) throw new Error("employeeId required");
  if (!orgId) throw new Error("orgId required");
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const m = Number(month);
  const y = Number(year);
  if (!Number.isFinite(m) || m < 1 || m > 12 || !Number.isFinite(y))
    throw new Error("Invalid month/year");
  const periodStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const periodEnd = `${y}-${String(m).padStart(2, "0")}-${String(
    lastDay
  ).padStart(2, "0")}`;

  const [lopRows] = await tenantPool.execute(
    `SELECT SUM(loss_of_pay_days) AS total_lop_days FROM leavequeries WHERE employee_id = ? AND status = 'Approved' AND start_date <= ? AND end_date >= ?`,
    [employeeId, periodEnd, periodStart]
  );
  const explicitLOP = Number(lopRows[0]?.total_lop_days || 0);
  if (explicitLOP > 0) {
    await tenantPool.execute(queries.UPSERT_EMPLOYEE_MONTHLY_LOP, [
      employeeId,
      m,
      y,
      explicitLOP,
    ]);
    return { month: m, year: y, total_lop: explicitLOP };
  }

  const policies = await getAllPolicies(orgId).catch((e) => {
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
    await tenantPool.execute(queries.UPSERT_EMPLOYEE_MONTHLY_LOP, [
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
    periodEnd,
    orgId
  ).catch(() => ({}));
  const workedUntilMonthEnd = await getWorkedDays(
    employeeId,
    active.year_start,
    periodEnd,
    orgId
  ).catch(() => 0);
  const policyYear = new Date(active.year_start).getFullYear();
  const employeeCFMap = await getEmployeeCarryForwards(
    employeeId,
    policyYear,
    orgId
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
  await tenantPool.execute(queries.UPSERT_EMPLOYEE_MONTHLY_LOP, [
    employeeId,
    m,
    y,
    total_lop,
  ]);
  return { month: m, year: y, total_lop };
}

const getMonthlyLOP = async (employeeId, month, year, orgId) => {
  if (!employeeId) throw new Error("employeeId required");
  if (!orgId) throw new Error("orgId required");
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const m = Number(month),
    y = Number(year);
  const [rows] = await tenantPool.execute(queries.GET_EMPLOYEE_MONTHLY_LOP, [
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
  return await computeAndStoreMonthlyLOP(employeeId, m, y, orgId);
};

const getLeaveBalance = async (employeeId, orgId) => {
  if (!employeeId) throw new Error("employeeId required");
  const policies = await getAllPolicies(orgId);
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
    upToDate,
    orgId
  );
  const usedMap = await getUsedLeavesInPeriod(
    employeeId,
    active.year_start,
    active.year_end,
    orgId
  );
  const policyYear = new Date(active.year_start).getFullYear();
  const employeeCFMap = await getEmployeeCarryForwards(
    employeeId,
    policyYear,
    orgId
  );
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

async function autoExtendRecentPolicies(
  extensionDays = 90,
  actorId = "system",
  orgId
) {
  if (!orgId) throw new Error("orgId required");
  const policies = await getAllPolicies(orgId);
  if (!Array.isArray(policies) || policies.length === 0) {
    return [];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - Number(extensionDays || 90));

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

    const endedOnOrBeforeToday = end <= today;
    const newerThanCutoff = end >= cutoff;

    if (endedOnOrBeforeToday && newerThanCutoff) {
      candidates.push({ policy: p, end });
    }
  }

  if (candidates.length === 0) {
    return [];
  }

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();
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

      await conn.execute(
        `UPDATE leave_policy SET year_end = ? WHERE id = ? AND org_id = ?`,
        [newEndStr, p.id, orgId]
      );

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

      try {
        await conn.execute(queries.INSERT_LEAVE_AUDIT, [
          null,
          actorId || "system",
          "policy_auto_extend",
          details,
          orgId,
        ]);
      } catch (auditErr) {
        console.warn(
          "[autoExtendRecentPolicies] failed to insert audit with leave_id=null:",
          auditErr && auditErr.message ? auditErr.message : auditErr
        );
      }

      const [rows] = await conn.execute(
        `SELECT id, period, DATE_FORMAT(year_start, '%Y-%m-%d') AS year_start, DATE_FORMAT(year_end, '%Y-%m-%d') AS year_end, leave_settings FROM leave_policy WHERE id = ? AND org_id = ?`,
        [p.id, orgId]
      );
      if (rows && rows[0]) {
        const row = rows[0];
        row.leave_settings = safeParseSettings(row.leave_settings);
        updated.push(row);
      }
    }

    await conn.commit();
    conn.release();

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
