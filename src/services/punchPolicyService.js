let tenantPoolManager = null;
try {
  tenantPoolManager = require("../db/tenantPoolManager");
} catch (e) {
  tenantPoolManager = null;
}

const PUNCH_POLICY_QUERIES = require("../constants/punchPolicyQueries");

function getTenantPool(orgId) {
  if (
    !tenantPoolManager ||
    typeof tenantPoolManager.getTenantPool !== "function"
  ) {
    try {
      const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
      return getTenantPoolByOrgId(orgId);
    } catch (_) {
      throw new Error("tenantPoolManager is not available.");
    }
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

function normalizePolicyType(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
  if (v === "missed_punch_in" || v === "miss_punch_out")
    return "miss_punch_out";
  if (v === "less_login_hours" || v === "less_hours") return "less_login_hours";
  if (v === "late_login" || v === "both") return "late_login";
  if (["late_login", "miss_punch_out", "less_login_hours"].includes(v))
    return v;
  return null;
}

function normalizeAppliesTo(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (v === "all" || v === "specific") return v;
  return null;
}

function normalizeDeductionBasis(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (v === "hours" || v === "hour" || v === "per_hour") return "percentage";
  if (v === "percentage" || v === "amount") return v;
  return "percentage";
}

function normalizeDeductionType(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
  if (v === "hour" || v === "per_hour") return "half_day";
  if (v === "per_day") return "full_day";
  if (v === "half_day" || v === "full_day") return v;
  return "half_day";
}

function normalizeStatus(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (v === "active" || v === "inactive") return v;
  return "active";
}

function normalizeShiftMode(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (v === "multiple" || v === "multi") return "multiple";
  return "general";
}

function isValidDateString(dateStr) {
  return typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function toTimeString(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  return null;
}

function toBoolInt(value, defaultVal = 0) {
  if (value === true || value === 1 || value === "1" || value === "true")
    return 1;
  if (value === false || value === 0 || value === "0" || value === "false")
    return 0;
  return defaultVal;
}

function safeJsonParse(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed != null ? parsed : fallback;
    } catch (_) {
      return fallback;
    }
  }
  return fallback;
}

function normalizeShifts(payload, bufferTime, punchIn, punchOut) {
  const raw = payload.shifts || payload.shift_config;
  if (Array.isArray(raw) && raw.length) {
    return raw.map((s, i) => ({
      name: String(s.name || `Shift ${i + 1}`).trim() || `Shift ${i + 1}`,
      punchInTime: s.punchInTime || s.punch_in_time || punchIn || "09:00",
      bufferTime: Number(s.bufferTime ?? s.buffer_time ?? bufferTime) || 0,
      punchOutTime: s.punchOutTime || s.punch_out_time || punchOut || "18:00",
    }));
  }
  return [
    {
      name: "General",
      punchInTime: punchIn || "09:00",
      bufferTime: Number(bufferTime) || 0,
      punchOutTime: punchOut || "18:00",
    },
  ];
}

function mapPolicyRow(row) {
  if (!row) return null;

  let policyType = row.policy_type;
  if (policyType === "missed_punch_in") policyType = "miss_punch_out";
  if (policyType === "both") policyType = "late_login";

  let deductionBasis = row.deduction_basis || "percentage";
  if (deductionBasis === "hours") deductionBasis = "percentage";

  let deductionType = row.deduction_type || "half_day";
  if (deductionType === "hour" || deductionType === "per_hour")
    deductionType = "half_day";
  if (deductionType === "per_day") deductionType = "full_day";

  const minDuration = String(row.min_duration ?? row.buffer_time ?? "15");
  const bufferTime = String(row.buffer_time ?? row.min_duration ?? "15");

  return {
    id: String(row.id),
    orgId: row.org_id,
    policyName: row.policy_name,
    description: row.description || "",
    policyType,
    appliesTo: row.applies_to,
    deductionBasis,
    deductionType,
    deductionValue: String(row.deduction_value ?? "0"),
    minDuration,
    limitWeekly: String(row.limit_weekly ?? "2"),
    limitMonthly: String(row.limit_monthly ?? "4"),
    halfDayBelowHours: String(row.half_day_below_hours ?? "3"),
    fullDayBelowHours: String(row.full_day_below_hours ?? "1"),
    enableFullDayThreshold:
      row.enable_full_day_threshold == null
        ? true
        : !!Number(row.enable_full_day_threshold),
    lateCountLimit: String(row.late_count_limit ?? "22"),
    lateWithinDays: String(row.late_within_days ?? "15"),
    shiftMode: row.shift_mode || "general",
    punchInTime: row.punch_in_time || "09:00",
    bufferTime,
    punchOutTime: row.punch_out_time || "18:00",
    shifts: safeJsonParse(row.shifts, []),
    skipIfRegularised:
      row.skip_if_regularised == null
        ? true
        : !!Number(row.skip_if_regularised),
    policyStatus: row.policy_status,
    effectiveFrom: row.effective_from,
    effectiveTill: row.effective_till || "",
    noExpiry: !row.effective_till,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAssignmentRow(row) {
  return {
    id: String(row.id),
    policyId: String(row.policy_id),
    assignmentType: row.assignment_type,
    referenceId: row.reference_id,
    referenceName: row.reference_name || row.reference_id,
  };
}

function validatePayload(payload) {
  const errors = [];

  const policyName = String(
    payload.policyName || payload.policy_name || "",
  ).trim();
  if (!policyName) errors.push("Policy name is required.");

  const policyType = normalizePolicyType(
    payload.policyType || payload.policy_type,
  );
  if (!policyType) {
    errors.push(
      "Invalid policy type. Use late_login, miss_punch_out, or less_login_hours.",
    );
  }

  const appliesTo = normalizeAppliesTo(
    payload.appliesTo || payload.applies_to || "specific",
  );
  if (!appliesTo) errors.push("Invalid appliesTo value.");

  const deductionBasis = normalizeDeductionBasis(
    payload.deductionBasis || payload.deduction_basis || "percentage",
  );
  const deductionType = normalizeDeductionType(
    payload.deductionType || payload.deduction_type || "half_day",
  );

  const deductionValue = Number(
    payload.deductionValue ?? payload.deduction_value ?? 0,
  );
  if (Number.isNaN(deductionValue) || deductionValue < 0) {
    errors.push("Deduction value must be a non-negative number.");
  }

  const effectiveFrom = payload.effectiveFrom || payload.effective_from || null;
  if (!isValidDateString(String(effectiveFrom || ""))) {
    errors.push("Effective from date is required (YYYY-MM-DD).");
  }

  const noExpiry =
    payload.noExpiry === true ||
    payload.no_expiry === true ||
    !(payload.effectiveTill || payload.effective_till);
  const effectiveTill = noExpiry
    ? null
    : payload.effectiveTill || payload.effective_till || null;

  if (effectiveTill && !isValidDateString(String(effectiveTill))) {
    errors.push("Effective till must be a valid date (YYYY-MM-DD).");
  }

  if (errors.length) {
    return { valid: false, message: errors.join(" ") };
  }

  const selectedGroups = Array.isArray(payload.selectedGroups)
    ? payload.selectedGroups
    : Array.isArray(payload.selected_groups)
      ? payload.selected_groups
      : [];

  const selectedEmployees = Array.isArray(payload.selectedEmployees)
    ? payload.selectedEmployees
    : Array.isArray(payload.selected_employees)
      ? payload.selected_employees
      : [];

  const exclusions = Array.isArray(payload.exclusions)
    ? payload.exclusions
    : [];

  const minDuration = Math.max(
    0,
    parseInt(
      payload.minDuration ??
        payload.min_duration ??
        payload.bufferTime ??
        payload.buffer_time ??
        15,
      10,
    ) || 0,
  );
  const bufferTime = Math.max(
    0,
    parseInt(
      payload.bufferTime ??
        payload.buffer_time ??
        payload.minDuration ??
        payload.min_duration ??
        minDuration,
      10,
    ) || 0,
  );
  const sharedBuffer = minDuration || bufferTime;

  const punchInTime =
    toTimeString(payload.punchInTime || payload.punch_in_time) || "09:00:00";
  const punchOutTime =
    toTimeString(payload.punchOutTime || payload.punch_out_time) || "18:00:00";

  const shiftMode = normalizeShiftMode(payload.shiftMode || payload.shift_mode);
  const shifts = normalizeShifts(
    payload,
    sharedBuffer,
    (payload.punchInTime || payload.punch_in_time || "09:00").slice(0, 5),
    (payload.punchOutTime || payload.punch_out_time || "18:00").slice(0, 5),
  ).map((s) => ({ ...s, bufferTime: sharedBuffer }));

  return {
    valid: true,
    data: {
      policyName,
      description: String(payload.description || "").trim(),
      policyType,
      appliesTo,
      deductionBasis,
      deductionType,
      deductionValue,
      minDuration: sharedBuffer,
      limitWeekly: Math.max(
        0,
        parseInt(payload.limitWeekly ?? payload.limit_weekly ?? 2, 10) || 0,
      ),
      limitMonthly: Math.max(
        0,
        parseInt(payload.limitMonthly ?? payload.limit_monthly ?? 4, 10) || 0,
      ),
      halfDayBelowHours: Number(
        payload.halfDayBelowHours ?? payload.half_day_below_hours ?? 3,
      ),
      fullDayBelowHours: Number(
        payload.fullDayBelowHours ?? payload.full_day_below_hours ?? 1,
      ),
      enableFullDayThreshold: toBoolInt(
        payload.enableFullDayThreshold ?? payload.enable_full_day_threshold,
        1,
      ),
      lateCountLimit: Math.max(
        0,
        parseInt(
          payload.lateCountLimit ?? payload.late_count_limit ?? 22,
          10,
        ) || 0,
      ),
      lateWithinDays: Math.max(
        0,
        parseInt(
          payload.lateWithinDays ?? payload.late_within_days ?? 15,
          10,
        ) || 0,
      ),
      shiftMode,
      punchInTime,
      bufferTime: sharedBuffer,
      punchOutTime,
      shifts,
      skipIfRegularised: toBoolInt(
        payload.skipIfRegularised ?? payload.skip_if_regularised,
        1,
      ),
      policyStatus: normalizeStatus(
        payload.policyStatus || payload.policy_status,
      ),
      effectiveFrom: String(effectiveFrom),
      effectiveTill: effectiveTill ? String(effectiveTill) : null,
      selectedGroups,
      selectedEmployees,
      exclusions,
    },
  };
}

async function assertEmployeesNotOnOtherPolicy({
  orgId,
  employees,
  excludePolicyId = null,
}) {
  if (!Array.isArray(employees) || employees.length === 0) return null;

  for (const emp of employees) {
    const empId = String(emp.id || emp.employee_id || emp).trim();
    if (!empId) continue;

    const [rows] = await queryTenant(
      orgId,
      PUNCH_POLICY_QUERIES.FIND_EMPLOYEE_OTHER_POLICY,
      [orgId, empId, excludePolicyId, excludePolicyId],
    );

    if (rows && rows.length > 0) {
      const r = rows[0];
      return {
        success: false,
        status: 409,
        message: `${r.employee_name || empId} is already assigned to policy “${r.policy_name}”. An employee can only be in one policy.`,
        data: {
          employeeId: r.employee_id,
          policyId: String(r.policy_id),
          policyName: r.policy_name,
        },
      };
    }
  }
  return null;
}

function policyInsertParams(orgId, d, employeeId) {
  return [
    orgId,
    d.policyName,
    d.description || null,
    d.policyType,
    d.appliesTo,
    d.deductionBasis,
    d.deductionType,
    d.deductionValue,
    d.minDuration,
    d.limitWeekly,
    d.limitMonthly,
    d.halfDayBelowHours,
    d.fullDayBelowHours,
    d.enableFullDayThreshold,
    d.lateCountLimit,
    d.lateWithinDays,
    d.shiftMode,
    d.punchInTime,
    d.bufferTime,
    d.punchOutTime,
    JSON.stringify(d.shifts || []),
    d.skipIfRegularised,
    d.policyStatus,
    d.effectiveFrom,
    d.effectiveTill,
    employeeId || null,
  ];
}

function policyUpdateParams(d, employeeId, id, orgId) {
  return [
    d.policyName,
    d.description || null,
    d.policyType,
    d.appliesTo,
    d.deductionBasis,
    d.deductionType,
    d.deductionValue,
    d.minDuration,
    d.limitWeekly,
    d.limitMonthly,
    d.halfDayBelowHours,
    d.fullDayBelowHours,
    d.enableFullDayThreshold,
    d.lateCountLimit,
    d.lateWithinDays,
    d.shiftMode,
    d.punchInTime,
    d.bufferTime,
    d.punchOutTime,
    JSON.stringify(d.shifts || []),
    d.skipIfRegularised,
    d.policyStatus,
    d.effectiveFrom,
    d.effectiveTill,
    employeeId || null,
    id,
    orgId,
  ];
}

async function listPolicies({ orgId, search = "" }) {
  if (!orgId) {
    return { success: false, status: 400, message: "Org ID is required." };
  }

  try {
    const [rows] = await queryTenant(
      orgId,
      PUNCH_POLICY_QUERIES.LIST_POLICIES,
      [orgId],
    );
    let list = (rows || []).map(mapPolicyRow);

    const q = String(search || "")
      .trim()
      .toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          (p.policyName || "").toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q),
      );
    }

    for (const policy of list) {
      try {
        const [assignRows] = await queryTenant(
          orgId,
          PUNCH_POLICY_QUERIES.GET_ASSIGNMENTS_BY_POLICY,
          [policy.id, orgId],
        );
        policy.selectedGroups = (assignRows || [])
          .filter(
            (a) =>
              a.assignment_type === "group" ||
              a.assignment_type === "department",
          )
          .map((a) => a.reference_name || a.reference_id);
        policy.selectedEmployees = (assignRows || [])
          .filter((a) => a.assignment_type === "employee")
          .map((a) => ({
            id: a.reference_id,
            name: a.reference_name || a.reference_id,
          }));
        policy.assignments = (assignRows || []).map(mapAssignmentRow);
      } catch (_) {
        policy.selectedGroups = [];
        policy.selectedEmployees = [];
        policy.assignments = [];
      }
    }

    return {
      success: true,
      status: 200,
      message: "Policies fetched successfully.",
      data: list,
    };
  } catch (err) {
    console.error("[listPolicies]", err?.message || err);
    return {
      success: false,
      status: 500,
      message: err?.sqlMessage || err?.message || "Failed to fetch policies.",
    };
  }
}

async function getPolicyById({ orgId, id }) {
  if (!orgId || !id) {
    return {
      success: false,
      status: 400,
      message: "Org ID and policy ID are required.",
    };
  }

  try {
    const [rows] = await queryTenant(
      orgId,
      PUNCH_POLICY_QUERIES.GET_POLICY_BY_ID,
      [id, orgId],
    );

    if (!rows || rows.length === 0) {
      return { success: false, status: 404, message: "Policy not found." };
    }

    const policy = mapPolicyRow(rows[0]);

    const [assignRows] = await queryTenant(
      orgId,
      PUNCH_POLICY_QUERIES.GET_ASSIGNMENTS_BY_POLICY,
      [id, orgId],
    );
    policy.selectedGroups = (assignRows || [])
      .filter(
        (a) =>
          a.assignment_type === "group" || a.assignment_type === "department",
      )
      .map((a) => a.reference_name || a.reference_id);
    policy.selectedEmployees = (assignRows || [])
      .filter((a) => a.assignment_type === "employee")
      .map((a) => ({
        id: a.reference_id,
        name: a.reference_name || a.reference_id,
      }));
    policy.assignments = (assignRows || []).map(mapAssignmentRow);

    try {
      const [exclRows] = await queryTenant(
        orgId,
        PUNCH_POLICY_QUERIES.GET_EXCLUSIONS_BY_POLICY,
        [id, orgId],
      );
      policy.exclusions = (exclRows || []).map((r) => ({
        id: String(r.id),
        exclusionType: r.exclusion_type,
        referenceId: r.reference_id,
        referenceName: r.reference_name || r.reference_id,
      }));
    } catch (_) {
      policy.exclusions = [];
    }

    return {
      success: true,
      status: 200,
      message: "Policy fetched successfully.",
      data: policy,
    };
  } catch (err) {
    console.error("[getPolicyById]", err?.message || err);
    return {
      success: false,
      status: 500,
      message: err?.sqlMessage || err?.message || "Failed to fetch policy.",
    };
  }
}

async function createPolicy({ orgId, employeeId, payload }) {
  if (!orgId) {
    return { success: false, status: 400, message: "Org ID is required." };
  }

  const validation = validatePayload(payload);
  if (!validation.valid) {
    return { success: false, status: 400, message: validation.message };
  }

  const d = validation.data;

  try {
    const conflict = await assertEmployeesNotOnOtherPolicy({
      orgId,
      employees: d.selectedEmployees,
      excludePolicyId: null,
    });
    if (conflict) return conflict;

    const [existing] = await queryTenant(
      orgId,
      PUNCH_POLICY_QUERIES.CHECK_POLICY_NAME_EXISTS,
      [orgId, d.policyName, null, null],
    );
    if (existing && existing.length > 0) {
      return {
        success: false,
        status: 409,
        message: "A policy with this name already exists.",
      };
    }

    const pool = await getTenantPool(orgId);
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [insertResult] = await conn.execute(
        PUNCH_POLICY_QUERIES.INSERT_POLICY,
        policyInsertParams(orgId, d, employeeId),
      );

      const policyId = insertResult.insertId;

      if (d.appliesTo === "specific" && Array.isArray(d.selectedGroups)) {
        for (const group of d.selectedGroups) {
          const name = String(group).trim();
          if (!name) continue;
          await conn.execute(PUNCH_POLICY_QUERIES.INSERT_ASSIGNMENT, [
            policyId,
            orgId,
            "group",
            name,
            name,
          ]);
        }
      }

      if (d.appliesTo === "specific" && Array.isArray(d.selectedEmployees)) {
        for (const emp of d.selectedEmployees) {
          const empId = String(emp.id || emp.employee_id || emp).trim();
          const empName = String(emp.name || empId).trim();
          if (!empId) continue;
          await conn.execute(PUNCH_POLICY_QUERIES.INSERT_ASSIGNMENT, [
            policyId,
            orgId,
            "employee",
            empId,
            empName,
          ]);
        }
      }

      if (Array.isArray(d.exclusions)) {
        for (const ex of d.exclusions) {
          const refId = String(
            ex.referenceId || ex.reference_id || ex.name || "",
          ).trim();
          if (!refId) continue;
          await conn.execute(PUNCH_POLICY_QUERIES.INSERT_EXCLUSION, [
            policyId,
            orgId,
            ex.exclusionType || ex.exclusion_type || "group",
            refId,
            ex.referenceName || ex.reference_name || refId,
          ]);
        }
      }

      await conn.commit();
      return getPolicyById({ orgId, id: policyId });
    } catch (txErr) {
      try {
        await conn.rollback();
      } catch (_) {}
      throw txErr;
    } finally {
      try {
        conn.release();
      } catch (_) {}
    }
  } catch (err) {
    console.error("[createPolicy]", err?.message || err);
    return {
      success: false,
      status: 500,
      message: err?.sqlMessage || err?.message || "Failed to create policy.",
    };
  }
}

async function updatePolicy({ orgId, employeeId, id, payload }) {
  if (!orgId || !id) {
    return {
      success: false,
      status: 400,
      message: "Org ID and policy ID are required.",
    };
  }

  const validation = validatePayload(payload);
  if (!validation.valid) {
    return { success: false, status: 400, message: validation.message };
  }

  const d = validation.data;

  try {
    const existing = await getPolicyById({ orgId, id });
    if (!existing.success) return existing;

    const conflict = await assertEmployeesNotOnOtherPolicy({
      orgId,
      employees: d.selectedEmployees,
      excludePolicyId: id,
    });
    if (conflict) return conflict;

    const [dup] = await queryTenant(
      orgId,
      PUNCH_POLICY_QUERIES.CHECK_POLICY_NAME_EXISTS,
      [orgId, d.policyName, id, id],
    );
    if (dup && dup.length > 0) {
      return {
        success: false,
        status: 409,
        message: "A policy with this name already exists.",
      };
    }

    const pool = await getTenantPool(orgId);
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [upd] = await conn.execute(
        PUNCH_POLICY_QUERIES.UPDATE_POLICY,
        policyUpdateParams(d, employeeId, id, orgId),
      );

      if (!upd || upd.affectedRows === 0) {
        await conn.rollback();
        return { success: false, status: 404, message: "Policy not found." };
      }

      await conn.execute(PUNCH_POLICY_QUERIES.DELETE_ASSIGNMENTS_BY_POLICY, [
        id,
        orgId,
      ]);

      if (d.appliesTo === "specific" && Array.isArray(d.selectedGroups)) {
        for (const group of d.selectedGroups) {
          const name = String(group).trim();
          if (!name) continue;
          await conn.execute(PUNCH_POLICY_QUERIES.INSERT_ASSIGNMENT, [
            id,
            orgId,
            "group",
            name,
            name,
          ]);
        }
      }

      if (d.appliesTo === "specific" && Array.isArray(d.selectedEmployees)) {
        for (const emp of d.selectedEmployees) {
          const empId = String(emp.id || emp.employee_id || emp).trim();
          const empName = String(emp.name || empId).trim();
          if (!empId) continue;
          await conn.execute(PUNCH_POLICY_QUERIES.INSERT_ASSIGNMENT, [
            id,
            orgId,
            "employee",
            empId,
            empName,
          ]);
        }
      }

      await conn.execute(PUNCH_POLICY_QUERIES.DELETE_EXCLUSIONS_BY_POLICY, [
        id,
        orgId,
      ]);

      if (Array.isArray(d.exclusions)) {
        for (const ex of d.exclusions) {
          const refId = String(
            ex.referenceId || ex.reference_id || ex.name || "",
          ).trim();
          if (!refId) continue;
          await conn.execute(PUNCH_POLICY_QUERIES.INSERT_EXCLUSION, [
            id,
            orgId,
            ex.exclusionType || ex.exclusion_type || "group",
            refId,
            ex.referenceName || ex.reference_name || refId,
          ]);
        }
      }

      await conn.commit();
      return getPolicyById({ orgId, id });
    } catch (txErr) {
      try {
        await conn.rollback();
      } catch (_) {}
      throw txErr;
    } finally {
      try {
        conn.release();
      } catch (_) {}
    }
  } catch (err) {
    console.error("[updatePolicy]", err?.message || err);
    return {
      success: false,
      status: 500,
      message: err?.sqlMessage || err?.message || "Failed to update policy.",
    };
  }
}

async function deletePolicy({ orgId, employeeId, id }) {
  if (!orgId || !id) {
    return {
      success: false,
      status: 400,
      message: "Org ID and policy ID are required.",
    };
  }

  try {
    const [result] = await queryTenant(
      orgId,
      PUNCH_POLICY_QUERIES.SOFT_DELETE_POLICY,
      [employeeId || null, id, orgId],
    );

    if (!result || result.affectedRows === 0) {
      return { success: false, status: 404, message: "Policy not found." };
    }

    return {
      success: true,
      status: 200,
      message: "Policy deleted successfully.",
      data: { id },
    };
  } catch (err) {
    console.error("[deletePolicy]", err?.message || err);
    return {
      success: false,
      status: 500,
      message: err?.sqlMessage || err?.message || "Failed to delete policy.",
    };
  }
}

async function getDepartments({ orgId }) {
  if (!orgId) {
    return { success: false, status: 400, message: "Org ID is required." };
  }
  try {
    const [rows] = await queryTenant(
      orgId,
      PUNCH_POLICY_QUERIES.GET_DEPARTMENTS,
      [orgId],
    );
    return {
      success: true,
      status: 200,
      data: (rows || []).map((r) => ({
        id: String(r.id),
        name: r.name,
      })),
    };
  } catch (err) {
    console.error("[getDepartments]", err);
    return {
      success: false,
      status: 500,
      message: err?.message || "Failed to fetch departments.",
    };
  }
}

async function getEmployeesForAssignment({ orgId, search = "" }) {
  if (!orgId) {
    return { success: false, status: 400, message: "Org ID is required." };
  }
  try {
    let rows;
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      [rows] = await queryTenant(
        orgId,
        PUNCH_POLICY_QUERIES.SEARCH_EMPLOYEES_FOR_ASSIGNMENT,
        [orgId, q, q, q, q, q],
      );
    } else {
      [rows] = await queryTenant(
        orgId,
        PUNCH_POLICY_QUERIES.GET_EMPLOYEES_FOR_ASSIGNMENT,
        [orgId],
      );
    }

    return {
      success: true,
      status: 200,
      data: (rows || []).map((r) => ({
        id: r.employee_id,
        name: r.name,
        email: r.email,
        department: r.department || "No Department",
        departmentId: r.department_id ? String(r.department_id) : null,
      })),
    };
  } catch (err) {
    console.error("[getEmployeesForAssignment]", err);
    return {
      success: false,
      status: 500,
      message: err?.message || "Failed to fetch employees.",
    };
  }
}

module.exports = {
  listPolicies,
  getPolicyById,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getDepartments,
  getEmployeesForAssignment,
};
