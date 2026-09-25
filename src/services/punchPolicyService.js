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
  if (["late_login", "missed_punch_in", "both"].includes(v)) return v;
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
  if (["hours", "percentage", "amount"].includes(v)) return v;
  if (v === "per_hour" || v === "hour") return "hours";
  return null;
}

function normalizeDeductionType(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
  if (["hour", "half_day", "full_day"].includes(v)) return v;
  if (v === "per_hour") return "hour";
  if (v === "per_day") return "full_day";
  return null;
}

function normalizeRounding(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
  if (["nearest_minute", "nearest_five", "nearest_half"].includes(v)) return v;
  return "nearest_minute";
}

function normalizeOperator(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (v === "greater" || v === "equal") return v;
  return "greater";
}

function normalizeStatus(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (v === "active" || v === "inactive") return v;
  return "active";
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
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (_) {
      return fallback;
    }
  }
  return fallback;
}

function mapPolicyRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    orgId: row.org_id,
    policyName: row.policy_name,
    description: row.description || "",
    policyType: row.policy_type,
    appliesTo: row.applies_to,
    deductionBasis: row.deduction_basis,
    deductionType: row.deduction_type,
    deductionValue: String(row.deduction_value ?? "0"),
    rounding: row.rounding,
    applyGraceTime: !!Number(row.apply_grace_time),
    graceMinutes: String(row.grace_minutes ?? "0"),
    minDuration: String(row.min_duration ?? "15"),
    markAsHalfDay: !!Number(row.mark_as_half_day),
    halfDayAfter: row.half_day_after || "03:00",
    halfDayOperator: row.half_day_operator || "greater",
    markAsFullDay: !!Number(row.mark_as_full_day),
    fullDayAfter: row.full_day_after || "06:00",
    fullDayOperator: row.full_day_operator || "greater",
    policyStatus: row.policy_status,
    effectiveFrom: row.effective_from,
    effectiveTill: row.effective_till || "",
    noExpiry: !row.effective_till,
    rules: safeJsonParse(row.rules, []),
    excuses: safeJsonParse(row.excuses, []),
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
  if (!policyType) errors.push("Invalid policy type.");

  const appliesTo = normalizeAppliesTo(
    payload.appliesTo || payload.applies_to || "specific",
  );
  if (!appliesTo) errors.push("Invalid appliesTo value.");

  const deductionBasis = normalizeDeductionBasis(
    payload.deductionBasis || payload.deduction_basis || "hours",
  );
  if (!deductionBasis) errors.push("Invalid deduction basis.");

  const deductionType = normalizeDeductionType(
    payload.deductionType || payload.deduction_type || "hour",
  );
  if (!deductionType) errors.push("Invalid deduction type.");

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
    !payload.effectiveTill;
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
  const rules = Array.isArray(payload.rules) ? payload.rules : [];
  const excuses = Array.isArray(payload.excuses) ? payload.excuses : [];

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
      rounding: normalizeRounding(payload.rounding),
      applyGraceTime: toBoolInt(
        payload.applyGraceTime ?? payload.apply_grace_time,
        1,
      ),
      graceMinutes: Math.max(
        0,
        parseInt(payload.graceMinutes ?? payload.grace_minutes ?? 15, 10) || 0,
      ),
      minDuration: Math.max(
        0,
        parseInt(payload.minDuration ?? payload.min_duration ?? 15, 10) || 0,
      ),
      markAsHalfDay: toBoolInt(
        payload.markAsHalfDay ?? payload.mark_as_half_day,
        1,
      ),
      halfDayAfter:
        toTimeString(payload.halfDayAfter || payload.half_day_after) ||
        "03:00:00",
      halfDayOperator: normalizeOperator(
        payload.halfDayOperator || payload.half_day_operator,
      ),
      markAsFullDay: toBoolInt(
        payload.markAsFullDay ?? payload.mark_as_full_day,
        1,
      ),
      fullDayAfter:
        toTimeString(payload.fullDayAfter || payload.full_day_after) ||
        "06:00:00",
      fullDayOperator: normalizeOperator(
        payload.fullDayOperator || payload.full_day_operator,
      ),
      policyStatus: normalizeStatus(
        payload.policyStatus || payload.policy_status,
      ),
      effectiveFrom: String(effectiveFrom),
      effectiveTill: effectiveTill ? String(effectiveTill) : null,
      selectedGroups,
      selectedEmployees,
      exclusions,
      rules,
      excuses,
    },
  };
}

/* ───────────── Public API ───────────── */

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
          .filter((a) => a.assignment_type === "group")
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
      .filter((a) => a.assignment_type === "group")
      .map((a) => a.reference_name || a.reference_id);
    policy.selectedEmployees = (assignRows || [])
      .filter((a) => a.assignment_type === "employee")
      .map((a) => ({
        id: a.reference_id,
        name: a.reference_name || a.reference_id,
      }));
    policy.assignments = (assignRows || []).map(mapAssignmentRow);

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
        [
          orgId,
          d.policyName,
          d.description || null,
          d.policyType,
          d.appliesTo,
          d.deductionBasis,
          d.deductionType,
          d.deductionValue,
          d.rounding,
          d.applyGraceTime,
          d.graceMinutes,
          d.minDuration,
          d.markAsHalfDay,
          d.halfDayAfter,
          d.halfDayOperator,
          d.markAsFullDay,
          d.fullDayAfter,
          d.fullDayOperator,
          d.policyStatus,
          d.effectiveFrom,
          d.effectiveTill,
          JSON.stringify(d.rules || []),
          JSON.stringify(d.excuses || []),
          employeeId || null,
        ],
      );

      const policyId = insertResult.insertId;

      // Groups
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

      // Employees
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

      // Exclusions
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

      const [upd] = await conn.execute(PUNCH_POLICY_QUERIES.UPDATE_POLICY, [
        d.policyName,
        d.description || null,
        d.policyType,
        d.appliesTo,
        d.deductionBasis,
        d.deductionType,
        d.deductionValue,
        d.rounding,
        d.applyGraceTime,
        d.graceMinutes,
        d.minDuration,
        d.markAsHalfDay,
        d.halfDayAfter,
        d.halfDayOperator,
        d.markAsFullDay,
        d.fullDayAfter,
        d.fullDayOperator,
        d.policyStatus,
        d.effectiveFrom,
        d.effectiveTill,
        JSON.stringify(d.rules || []),
        JSON.stringify(d.excuses || []),
        employeeId || null,
        id,
        orgId,
      ]);

      if (!upd || upd.affectedRows === 0) {
        await conn.rollback();
        return { success: false, status: 404, message: "Policy not found." };
      }

      // Replace assignments
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

      // Replace exclusions
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
