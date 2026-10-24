// const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");
// const queries = require("../constants/salaryAttendanceDeductionQueries");

// const POLICY_TYPES = ["late_login", "miss_punch_out", "less_login_hours"];

// function getDateKey(value) {
//   if (!value) return null;
//   if (typeof value === "string") {
//     const match = value.match(/^\d{4}-\d{2}-\d{2}/);
//     if (match) return match[0];
//   }
//   const date = new Date(value);
//   if (Number.isNaN(date.getTime())) return null;
//   return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
// }

// function formatDate(date) {
//   return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
// }

// function getPayrollPeriod(month, year, cutoffDate) {
//   const monthNumber = Number(month);
//   const yearNumber = Number(year);
//   const cutoff = Number(cutoffDate);
//   if (
//     !Number.isInteger(monthNumber) ||
//     monthNumber < 1 ||
//     monthNumber > 12 ||
//     !Number.isInteger(yearNumber) ||
//     yearNumber < 2000 ||
//     yearNumber > 2200 ||
//     !Number.isInteger(cutoff) ||
//     cutoff < 1 ||
//     cutoff > 31
//   ) {
//     throw new Error("A valid payroll month, year, and cutoff date are required.");
//   }

//   const endMonthLastDate = new Date(Date.UTC(yearNumber, monthNumber, 0)).getUTCDate();
//   const endDate = new Date(
//     Date.UTC(yearNumber, monthNumber - 1, Math.min(cutoff, endMonthLastDate)),
//   );
//   const startMonthLastDate = new Date(Date.UTC(yearNumber, monthNumber - 1, 0)).getUTCDate();
//   const previousCutoff = new Date(
//     Date.UTC(yearNumber, monthNumber - 2, Math.min(cutoff, startMonthLastDate)),
//   );
//   previousCutoff.setUTCDate(previousCutoff.getUTCDate() + 1);

//   return { startDate: formatDate(previousCutoff), endDate: formatDate(endDate) };
// }

// function getAttendanceContextStartDate(periodStart, policies) {
//   const hasMissPunchPolicy = policies.some(
//     (policy) => policy.policy_type === "miss_punch_out",
//   );
//   const withinDays = policies
//     .filter((policy) => policy.policy_type === "late_login")
//     .reduce(
//       (maximum, policy) => Math.max(maximum, Number(policy.late_within_days || 1)),
//       1,
//     );
//   const lookbackDays = Math.max(withinDays, hasMissPunchPolicy ? 31 : 1);
//   const date = new Date(`${periodStart}T00:00:00Z`);
//   date.setUTCDate(date.getUTCDate() - lookbackDays + 1);
//   return formatDate(date);
// }

// function parseSelectedDates(value, primaryDate) {
//   let dates = [];
//   if (Array.isArray(value)) {
//     dates = value;
//   } else if (typeof value === "string") {
//     try {
//       const parsed = JSON.parse(value);
//       if (Array.isArray(parsed)) dates = parsed;
//     } catch (error) {
//       throw new Error("Unable to parse approved regularisation selected_dates.", {
//         cause: error,
//       });
//     }
//   }
//   if (dates.length === 0 && primaryDate) dates = [primaryDate];
//   return dates.map(getDateKey).filter(Boolean);
// }

// function isAutomaticPunchOut(row) {
//   return [row.punchmode, row.punchout_device, row.punchout_location]
//     .some((value) => String(value || "").toLowerCase() === "automatic");
// }

// function isLate(row, policy) {
//   if (Number(row.late_login) === 1) return true;
//   if (!row.punchin_time || !policy.punch_in_time) {
//     return false;
//   }

//   const punchIn = new Date(row.punchin_time);
//   if (Number.isNaN(punchIn.getTime())) return false;
//   const time = String(policy.punch_in_time).slice(0, 8);
//   const [hours, minutes, seconds = 0] = time.split(":").map(Number);
//   const threshold = new Date(punchIn);
//   threshold.setHours(hours, minutes, seconds, 0);
//   threshold.setMinutes(threshold.getMinutes() + Number(policy.buffer_time || policy.min_duration || 0));
//   return punchIn > threshold;
// }

// function normalizePolicyType(value) {
//   if (value === "missed_punch_in") return "miss_punch_out";
//   return POLICY_TYPES.includes(value) ? value : null;
// }

// function groupPolicies(rows) {
//   const policies = new Map();
//   for (const row of rows) {
//     const type = normalizePolicyType(row.policy_type);
//     if (!type) continue;
//     if (!policies.has(String(row.id))) {
//       policies.set(String(row.id), {
//         id: String(row.id),
//         ...row,
//         policy_type: type,
//         assignments: [],
//       });
//     }
//     if (row.assignment_type) {
//       policies.get(String(row.id)).assignments.push({
//         type: row.assignment_type,
//         id: String(row.reference_id || ""),
//         name: String(row.reference_name || ""),
//       });
//     }
//   }
//   return Array.from(policies.values());
// }

// function matchesPolicy(employee, policy) {
//   if (policy.applies_to === "all") return true;
//   return policy.assignments.some((assignment) => {
//     if (assignment.type === "employee") {
//       return assignment.id === String(employee.employee_id);
//     }
//     if (assignment.type === "department" || assignment.type === "group") {
//       return (
//         assignment.id === String(employee.department_id || "") ||
//         assignment.name.toLowerCase() === String(employee.department_name || "").toLowerCase() ||
//         assignment.id.toLowerCase() === String(employee.department_name || "").toLowerCase()
//       );
//     }
//     return false;
//   });
// }

// function selectPolicy(employee, policies, type) {
//   return policies
//     .filter((policy) => policy.policy_type === type && matchesPolicy(employee, policy))
//     .sort((a, b) => {
//       const score = (policy) => {
//         if (policy.applies_to === "all") return 0;
//         if (policy.assignments.some((a) => a.type === "employee" && a.id === String(employee.employee_id))) return 2;
//         return 1;
//       };
//       return score(b) - score(a) || Number(b.id) - Number(a.id);
//     })[0] || null;
// }

// function buildDailyAttendance(rows, policiesByType) {
//   const daily = new Map();
//   for (const row of rows) {
//     const date = getDateKey(row.attendance_date || row.punchin_time || row.punchout_time);
//     if (!date) continue;
//     if (!daily.has(date)) {
//       daily.set(date, {
//         date,
//         rows: [],
//         late: false,
//         missedPunchOut: false,
//         workedHours: 0,
//         hasCompletePunchData: false,
//         department_id: row.department_id,
//         department_name: row.department_name,
//       });
//     }
//     const day = daily.get(date);
//     day.rows.push(row);
//     const latePolicy = policiesByType.late_login;
//     if (latePolicy && isLate(row, latePolicy)) day.late = true;
//   }

//   for (const day of daily.values()) {
//     const hasPunchIn = day.rows.some(
//       (row) => row.punchin_time || String(row.punch_status || "").toLowerCase() === "punch in",
//     );
//     const hasManualPunchOut = day.rows.some(
//       (row) => row.punchout_time && !isAutomaticPunchOut(row),
//     );
//     const hasAutomaticPunchOut = day.rows.some(
//       (row) => row.punchout_time && isAutomaticPunchOut(row),
//     );
//     day.hasCompletePunchData = hasPunchIn && hasManualPunchOut;
//     day.missedPunchOut = hasAutomaticPunchOut || (hasPunchIn && !hasManualPunchOut);

//     for (const row of day.rows) {
//       if (!row.punchin_time || !row.punchout_time || isAutomaticPunchOut(row)) continue;
//       const start = new Date(row.punchin_time);
//       const end = new Date(row.punchout_time);
//       if (end > start) day.workedHours += (end.getTime() - start.getTime()) / 3600000;
//     }
//   }

//   return Array.from(daily.values()).sort((a, b) => a.date.localeCompare(b.date));
// }

// function regularisationMatches(approvedDates, employeeId, type, date) {
//   return approvedDates.has(`${employeeId}:${type}:${date}`);
// }

// function collectEvents(employee, dailyRows, policy, type, approvedDates, period) {
//   const skipApproved = Number(policy.skip_if_regularised) !== 0;
//   const events = [];
//   for (const day of dailyRows) {
//     const date = day.date;
//     const isInPayrollPeriod = date >= period.startDate && date <= period.endDate;
//     if (
//       date < getDateKey(policy.effective_from) ||
//       (policy.effective_till && date > getDateKey(policy.effective_till))
//     ) {
//       continue;
//     }
//     if (type === "late_login" && day.late) {
//       const regularised = regularisationMatches(
//         approvedDates,
//         employee.employee_id,
//         "late_login",
//         date,
//       );
//       if (!skipApproved || !regularised) {
//         events.push({
//           date,
//           dayFraction: policy.deduction_type === "full_day" ? 1 : 0.5,
//           isInPayrollPeriod,
//         });
//       }
//     } else if (type === "miss_punch_out" && day.missedPunchOut) {
//       const regularised =
//         regularisationMatches(approvedDates, employee.employee_id, "missed_punch_out", date) ||
//         regularisationMatches(approvedDates, employee.employee_id, "missed_punch_in", date);
//       if (!skipApproved || !regularised) {
//         events.push({
//           date,
//           dayFraction: policy.deduction_type === "full_day" ? 1 : 0.5,
//           isInPayrollPeriod,
//         });
//       }
//     } else if (type === "less_login_hours") {
//       if (!isInPayrollPeriod) continue;
//       if (!day.hasCompletePunchData) continue;
//       const lessPolicy = policy;
//       const halfThreshold = Number(lessPolicy.half_day_below_hours || 0);
//       const fullThreshold = Number(lessPolicy.full_day_below_hours || 0);
//       const belowFullDay =
//         Number(lessPolicy.enable_full_day_threshold) !== 0 &&
//         day.workedHours < fullThreshold;
//       const belowHalfDay = day.workedHours < halfThreshold;
//       const hasViolation = belowFullDay || belowHalfDay;
//       const regularised = ["late_login", "missed_punch_out", "missed_punch_in", "deficit_in_punch_hours"]
//         .some((regularisationType) =>
//           regularisationMatches(approvedDates, employee.employee_id, regularisationType, date),
//         );
//       if (hasViolation && (!skipApproved || !regularised)) {
//         events.push({
//           date,
//           dayFraction: belowFullDay ? 1 : 0.5,
//           isInPayrollPeriod,
//         });
//       }
//     }
//   }

//   if (type === "late_login") {
//     const limit = Math.max(0, Number(policy.late_count_limit || 0));
//     const withinDays = Math.max(1, Number(policy.late_within_days || 1));
//     const deductionEvents = events.filter((event, index) => {
//       const eventDate = new Date(`${event.date}T00:00:00Z`).getTime();
//       const lowerBound = eventDate - (withinDays - 1) * 86400000;
//       const rollingCount = events
//         .slice(0, index + 1)
//         .filter((candidate) => {
//           const candidateDate = new Date(`${candidate.date}T00:00:00Z`).getTime();
//           return candidateDate >= lowerBound && candidateDate <= eventDate;
//         }).length;
//       return rollingCount > limit && event.isInPayrollPeriod;
//     });
//     return {
//       count: events.filter((event) => event.isInPayrollPeriod).length,
//       deductionEvents,
//     };
//   }

//   if (type === "miss_punch_out") {
//     const weeklyLimit = Math.max(0, Number(policy.limit_weekly || 0));
//     const monthlyLimit = Math.max(0, Number(policy.limit_monthly || 0));
//     const deductionEvents = events.filter((event) => {
//       const date = new Date(`${event.date}T00:00:00Z`);
//       const monday = new Date(date);
//       const weekday = (monday.getUTCDay() + 6) % 7;
//       monday.setUTCDate(monday.getUTCDate() - weekday);
//       const weekStart = formatDate(monday);
//       const month = event.date.slice(0, 7);
//       const weeklyCount = events.filter((item) => {
//         const itemDate = new Date(`${item.date}T00:00:00Z`);
//         const itemMonday = new Date(itemDate);
//         itemMonday.setUTCDate(itemMonday.getUTCDate() - ((itemMonday.getUTCDay() + 6) % 7));
//         return formatDate(itemMonday) === weekStart && item.date <= event.date;
//       }).length;
//       const monthlyCount = events.filter(
//         (item) => item.date.slice(0, 7) === month && item.date <= event.date,
//       ).length;
//       return (
//         (weeklyCount > weeklyLimit || monthlyCount > monthlyLimit) &&
//         event.isInPayrollPeriod
//       );
//     });
//     return {
//       count: events.filter((event) => event.isInPayrollPeriod).length,
//       deductionEvents,
//     };
//   }

//   const periodEvents = events.filter((event) => event.isInPayrollPeriod);
//   return { count: periodEvents.length, deductionEvents: periodEvents };
// }

// function getDeduction(policy, { count, deductionEvents }, annualCtc) {
//   if (!deductionEvents.length) return { count, amount: 0 };
//   const deductionValue = Number(policy.deduction_value || 0);
//   if (String(policy.deduction_basis).toLowerCase() === "amount") {
//     return { count, amount: deductionValue * deductionEvents.length };
//   }

//   const dailySalary = Math.max(0, Number(annualCtc || 0) / 12 / 30);
//   const amount = deductionEvents.reduce(
//     (total, event) =>
//       total + dailySalary * event.dayFraction * (deductionValue / 100),
//     0,
//   );
//   return { count, amount };
// }

// async function calculateSalaryAttendanceDeductions({ orgId, month, year, employees }) {
//   if (!orgId) throw new Error("orgId is required.");
//   if (!Array.isArray(employees)) throw new Error("employees must be an array.");

//   const pool = await getTenantPool(sanitizeDbName(`tenant_${orgId}`));
//   const [periodRows] = await pool.execute(
//     "SELECT cutoff_date FROM salary_calculation_period WHERE org_id = ? ORDER BY id DESC LIMIT 1",
//     [orgId],
//   );
//   const cutoffDate = Number(periodRows[0]?.cutoff_date || 31);
//   const { startDate, endDate } = getPayrollPeriod(month, year, cutoffDate);

//   const [policyResult, regularisationResult] = await Promise.all([
//     pool.execute(queries.GET_POLICIES, [orgId, endDate, startDate]),
//     pool.execute(queries.GET_APPROVED_REGULARISATIONS, [orgId]),
//   ]);
//   const [policyRows] = policyResult;
//   const [regularisationRows] = regularisationResult;

//   const policies = groupPolicies(policyRows || []);
//   const attendanceStartDate = getAttendanceContextStartDate(startDate, policies);
//   const [attendanceRows] = await pool.execute(
//     queries.GET_ATTENDANCE,
//     [orgId, attendanceStartDate, endDate],
//   );
//   const approvedDates = new Set();
//   for (const row of regularisationRows || []) {
//     const type = String(row.regularisation_type || "").toLowerCase();
//     for (const date of parseSelectedDates(row.selected_dates, row.primary_date)) {
//       approvedDates.add(`${row.employee_id}:${type}:${date}`);
//     }
//   }

//   const employeeInputs = new Map(
//     employees
//       .filter((employee) => employee && employee.employee_id != null)
//       .map((employee) => [
//         String(employee.employee_id),
//         { annualCtc: Number(employee.annualCtc || employee.annual_ctc || 0) },
//       ]),
//   );
//   const attendanceByEmployee = new Map();
//   for (const row of attendanceRows || []) {
//     const employeeId = String(row.employee_id);
//     if (!employeeInputs.has(employeeId)) continue;
//     if (!attendanceByEmployee.has(employeeId)) attendanceByEmployee.set(employeeId, []);
//     attendanceByEmployee.get(employeeId).push(row);
//   }

//   const data = {};
//   for (const [employeeId, employeeInput] of employeeInputs) {
//     const employeeAttendance = attendanceByEmployee.get(employeeId) || [];
//     const employee = {
//       employee_id: employeeId,
//       department_id: employeeAttendance[0]?.department_id,
//       department_name: employeeAttendance[0]?.department_name,
//     };
//     const result = {
//       lateLogin: { count: 0, amount: 0 },
//       missPunchOut: { count: 0, amount: 0 },
//       lessLoginHours: { count: 0, amount: 0 },
//       period: { startDate, endDate },
//     };
//     const typeKeys = {
//       late_login: "lateLogin",
//       miss_punch_out: "missPunchOut",
//       less_login_hours: "lessLoginHours",
//     };

//     for (const type of POLICY_TYPES) {
//       const policy = selectPolicy(employee, policies, type);
//       if (!policy) continue;
//       const dailyRows = buildDailyAttendance(
//         employeeAttendance,
//         { [type]: policy },
//       );
//       const events = collectEvents(employee, dailyRows, policy, type, approvedDates, {
//         startDate,
//         endDate,
//       });
//       result[typeKeys[type]] = getDeduction(policy, events, employeeInput.annualCtc);
//     }
//     data[employeeId] = result;
//   }

//   return data;
// }

// module.exports = { calculateSalaryAttendanceDeductions, getPayrollPeriod };

const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");
const queries = require("../constants/salaryAttendanceDeductionQueries");
const {
  ensurePunchPolicyDeductionSchema,
} = require("./punchPolicyDeductionSchema");

const POLICY_TYPES = ["late_login", "miss_punch_out", "less_login_hours"];

function getDateKey(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function getPayrollPeriod(month, year, cutoffDate) {
  const monthNumber = Number(month);
  const yearNumber = Number(year);
  const cutoff = Number(cutoffDate);
  if (
    !Number.isInteger(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12 ||
    !Number.isInteger(yearNumber) ||
    yearNumber < 2000 ||
    yearNumber > 2200 ||
    !Number.isInteger(cutoff) ||
    cutoff < 1 ||
    cutoff > 31
  ) {
    throw new Error(
      "A valid payroll month, year, and cutoff date are required.",
    );
  }

  const endMonthLastDate = new Date(
    Date.UTC(yearNumber, monthNumber, 0),
  ).getUTCDate();
  const endDate = new Date(
    Date.UTC(yearNumber, monthNumber - 1, Math.min(cutoff, endMonthLastDate)),
  );
  const startMonthLastDate = new Date(
    Date.UTC(yearNumber, monthNumber - 1, 0),
  ).getUTCDate();
  const previousCutoff = new Date(
    Date.UTC(yearNumber, monthNumber - 2, Math.min(cutoff, startMonthLastDate)),
  );

  return {
    startDate: formatDate(previousCutoff),
    endDate: formatDate(endDate),
  };
}

function getAttendanceContextStartDate(periodStart, policies) {
  const hasMissPunchPolicy = policies.some(
    (policy) => policy.policy_type === "miss_punch_out",
  );
  const withinDays = policies
    .filter((policy) => policy.policy_type === "late_login")
    .reduce(
      (maximum, policy) =>
        Math.max(maximum, Number(policy.late_within_days || 1)),
      1,
    );
  const lookbackDays = Math.max(withinDays, hasMissPunchPolicy ? 31 : 1);
  const date = new Date(`${periodStart}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - lookbackDays + 1);
  return formatDate(date);
}

function parseSelectedDates(value, primaryDate) {
  let dates = [];
  if (Array.isArray(value)) {
    dates = value;
  } else if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) dates = parsed;
    } catch (error) {
      throw new Error(
        "Unable to parse approved regularisation selected_dates.",
        {
          cause: error,
        },
      );
    }
  }
  if (dates.length === 0 && primaryDate) dates = [primaryDate];
  return dates.map(getDateKey).filter(Boolean);
}

function isAutomaticPunchOut(row) {
  return [row.punchmode, row.punchout_device, row.punchout_location].some(
    (value) => String(value || "").toLowerCase() === "automatic",
  );
}

function isLate(row, policy) {
  if (Number(row.late_login) === 1) return true;
  if (!row.punchin_time || !policy.punch_in_time) {
    return false;
  }

  const punchIn = new Date(row.punchin_time);
  if (Number.isNaN(punchIn.getTime())) return false;
  const time = String(policy.punch_in_time).slice(0, 8);
  const [hours, minutes, seconds = 0] = time.split(":").map(Number);
  const threshold = new Date(punchIn);
  threshold.setHours(hours, minutes, seconds, 0);
  threshold.setMinutes(
    threshold.getMinutes() +
      Number(policy.buffer_time || policy.min_duration || 0),
  );
  return punchIn > threshold;
}

function normalizePolicyType(value) {
  if (value === "missed_punch_in") return "miss_punch_out";
  return POLICY_TYPES.includes(value) ? value : null;
}

function groupPolicies(rows) {
  const policies = new Map();
  for (const row of rows) {
    const type = normalizePolicyType(row.policy_type);
    if (!type) continue;
    if (!policies.has(String(row.id))) {
      policies.set(String(row.id), {
        id: String(row.id),
        ...row,
        policy_type: type,
        assignments: [],
      });
    }
    if (row.assignment_type) {
      policies.get(String(row.id)).assignments.push({
        type: row.assignment_type,
        id: String(row.reference_id || ""),
        name: String(row.reference_name || ""),
      });
    }
  }
  return Array.from(policies.values());
}

function matchesPolicy(employee, policy) {
  if (policy.applies_to === "all") return true;
  return policy.assignments.some((assignment) => {
    if (assignment.type === "employee") {
      return assignment.id === String(employee.employee_id);
    }
    if (assignment.type === "department" || assignment.type === "group") {
      return (
        assignment.id === String(employee.department_id || "") ||
        assignment.name.toLowerCase() ===
          String(employee.department_name || "").toLowerCase() ||
        assignment.id.toLowerCase() ===
          String(employee.department_name || "").toLowerCase()
      );
    }
    return false;
  });
}

function selectPolicy(employee, policies, type) {
  return (
    policies
      .filter(
        (policy) =>
          policy.policy_type === type && matchesPolicy(employee, policy),
      )
      .sort((a, b) => {
        const score = (policy) => {
          if (policy.applies_to === "all") return 0;
          if (
            policy.assignments.some(
              (a) =>
                a.type === "employee" && a.id === String(employee.employee_id),
            )
          )
            return 2;
          return 1;
        };
        return score(b) - score(a) || Number(b.id) - Number(a.id);
      })[0] || null
  );
}

function buildDailyAttendance(rows, policiesByType) {
  const daily = new Map();
  for (const row of rows) {
    const date = getDateKey(
      row.attendance_date || row.punchin_time || row.punchout_time,
    );
    if (!date) continue;
    if (!daily.has(date)) {
      daily.set(date, {
        date,
        rows: [],
        late: false,
        missedPunchOut: false,
        workedHours: 0,
        hasCompletePunchData: false,
        department_id: row.department_id,
        department_name: row.department_name,
      });
    }
    const day = daily.get(date);
    day.rows.push(row);
    const latePolicy = policiesByType.late_login;
    if (latePolicy && isLate(row, latePolicy)) day.late = true;
  }

  for (const day of daily.values()) {
    const hasPunchIn = day.rows.some(
      (row) =>
        row.punchin_time ||
        String(row.punch_status || "").toLowerCase() === "punch in",
    );
    const hasManualPunchOut = day.rows.some(
      (row) => row.punchout_time && !isAutomaticPunchOut(row),
    );
    const hasAutomaticPunchOut = day.rows.some(
      (row) => row.punchout_time && isAutomaticPunchOut(row),
    );
    day.hasCompletePunchData = hasPunchIn && hasManualPunchOut;
    day.missedPunchOut =
      hasAutomaticPunchOut || (hasPunchIn && !hasManualPunchOut);

    for (const row of day.rows) {
      if (!row.punchin_time || !row.punchout_time || isAutomaticPunchOut(row))
        continue;
      const start = new Date(row.punchin_time);
      const end = new Date(row.punchout_time);
      if (end > start)
        day.workedHours += (end.getTime() - start.getTime()) / 3600000;
    }
  }

  return Array.from(daily.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

function regularisationMatches(approvedDates, employeeId, type, date) {
  return approvedDates.has(`${employeeId}:${type}:${date}`);
}

function collectEvents(
  employee,
  dailyRows,
  policy,
  type,
  approvedDates,
  period,
) {
  const skipApproved = Number(policy.skip_if_regularised) !== 0;
  const events = [];
  for (const day of dailyRows) {
    const date = day.date;
    const isInPayrollPeriod =
      date >= period.startDate && date <= period.endDate;
    if (
      date < getDateKey(policy.effective_from) ||
      (policy.effective_till && date > getDateKey(policy.effective_till))
    ) {
      continue;
    }
    if (type === "late_login" && day.late) {
      const regularised = regularisationMatches(
        approvedDates,
        employee.employee_id,
        "late_login",
        date,
      );
      if (!skipApproved || !regularised) {
        events.push({
          date,
          dayFraction: policy.deduction_type === "full_day" ? 1 : 0.5,
          deductionType:
            policy.deduction_type === "full_day" ? "full_day" : "half_day",
          deductionBasis:
            (policy.deduction_type === "full_day"
              ? policy.full_day_deduction_basis
              : policy.half_day_deduction_basis) ?? policy.deduction_basis,
          deductionValue:
            (policy.deduction_type === "full_day"
              ? policy.full_day_deduction_value
              : policy.half_day_deduction_value) ?? policy.deduction_value,
          isInPayrollPeriod,
        });
      }
    } else if (type === "miss_punch_out" && day.missedPunchOut) {
      const regularised =
        regularisationMatches(
          approvedDates,
          employee.employee_id,
          "missed_punch_out",
          date,
        ) ||
        regularisationMatches(
          approvedDates,
          employee.employee_id,
          "missed_punch_in",
          date,
        );
      if (!skipApproved || !regularised) {
        events.push({
          date,
          dayFraction: policy.deduction_type === "full_day" ? 1 : 0.5,
          deductionType:
            policy.deduction_type === "full_day" ? "full_day" : "half_day",
          deductionBasis:
            (policy.deduction_type === "full_day"
              ? policy.full_day_deduction_basis
              : policy.half_day_deduction_basis) ?? policy.deduction_basis,
          deductionValue:
            (policy.deduction_type === "full_day"
              ? policy.full_day_deduction_value
              : policy.half_day_deduction_value) ?? policy.deduction_value,
          isInPayrollPeriod,
        });
      }
    } else if (type === "less_login_hours") {
      if (!isInPayrollPeriod) continue;
      if (!day.hasCompletePunchData) continue;
      const lessPolicy = policy;
      const halfThreshold = Number(lessPolicy.half_day_below_hours || 0);
      const fullThreshold = Number(lessPolicy.full_day_below_hours || 0);
      const belowFullDay =
        Number(lessPolicy.enable_full_day_threshold) !== 0 &&
        day.workedHours < fullThreshold;
      const belowHalfDay = day.workedHours < halfThreshold;
      const hasViolation = belowFullDay || belowHalfDay;
      const regularised = [
        "late_login",
        "missed_punch_out",
        "missed_punch_in",
        "deficit_in_punch_hours",
      ].some((regularisationType) =>
        regularisationMatches(
          approvedDates,
          employee.employee_id,
          regularisationType,
          date,
        ),
      );
      if (hasViolation && (!skipApproved || !regularised)) {
        const useFullDayDeduction = belowFullDay;
        events.push({
          date,
          dayFraction: useFullDayDeduction ? 1 : 0.5,
          deductionType: useFullDayDeduction ? "full_day" : "half_day",
          deductionBasis: useFullDayDeduction
            ? (lessPolicy.full_day_deduction_basis ??
              lessPolicy.deduction_basis)
            : (lessPolicy.half_day_deduction_basis ??
              lessPolicy.deduction_basis),
          deductionValue: useFullDayDeduction
            ? (lessPolicy.full_day_deduction_value ??
              lessPolicy.deduction_value)
            : (lessPolicy.half_day_deduction_value ??
              lessPolicy.deduction_value),
          isInPayrollPeriod,
        });
      }
    }
  }

  if (type === "late_login") {
    const limit = Math.max(0, Number(policy.late_count_limit || 0));
    const withinDays = Math.max(1, Number(policy.late_within_days || 1));
    const deductionEvents = events.filter((event, index) => {
      const eventDate = new Date(`${event.date}T00:00:00Z`).getTime();
      const lowerBound = eventDate - (withinDays - 1) * 86400000;
      const rollingCount = events.slice(0, index + 1).filter((candidate) => {
        const candidateDate = new Date(`${candidate.date}T00:00:00Z`).getTime();
        return candidateDate >= lowerBound && candidateDate <= eventDate;
      }).length;
      return rollingCount > limit && event.isInPayrollPeriod;
    });
    return {
      count: events.filter((event) => event.isInPayrollPeriod).length,
      deductionEvents,
    };
  }

  if (type === "miss_punch_out") {
    const freeLimit = Math.max(0, Number(policy.limit_weekly || 0));
    const withinDays = Math.max(1, Number(policy.late_within_days || 1));
    const deductionEvents = events.filter((event, index) => {
      const eventDate = new Date(`${event.date}T00:00:00Z`).getTime();
      const lowerBound = eventDate - (withinDays - 1) * 86400000;
      const rollingCount = events.slice(0, index + 1).filter((candidate) => {
        const candidateDate = new Date(`${candidate.date}T00:00:00Z`).getTime();
        return candidateDate >= lowerBound && candidateDate <= eventDate;
      }).length;
      return rollingCount > freeLimit && event.isInPayrollPeriod;
    });
    return {
      count: events.filter((event) => event.isInPayrollPeriod).length,
      deductionEvents,
    };
  }

  const periodEvents = events.filter((event) => event.isInPayrollPeriod);
  return { count: periodEvents.length, deductionEvents: periodEvents };
}

function calculateAttendanceDeductionAmount({
  dailySalary,
  deductionType,
  deductionBasis,
  deductionValue,
  dayFraction,
}) {
  const fraction =
    deductionType === "half_day"
      ? 0.5
      : deductionType === "full_day"
        ? 1
        : Number(dayFraction || 0);
  const value = Number(deductionValue || 0);

  return String(deductionBasis).toLowerCase() === "amount"
    ? value
    : dailySalary * fraction * (value / 100);
}

function getDeduction(policy, { count, deductionEvents }, annualCtc, periodEndDate) {
  const eligibleCount = deductionEvents.length;
  const [year, month] = periodEndDate.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dailySalary = Math.max(
    0,
    Number(annualCtc || 0) / 12 / daysInMonth,
  );
  const breakdownByMethod = new Map();
  const amount = deductionEvents.reduce((total, event) => {
    const deductionBasis = String(
      event.deductionBasis ?? policy.deduction_basis,
    ).toLowerCase();
    const deductionValue = Number(
      event.deductionValue ?? policy.deduction_value ?? 0,
    );
    const deductionType =
      event.deductionType ||
      (event.dayFraction === 1 ? "full_day" : "half_day");
    const amountForEvent = calculateAttendanceDeductionAmount({
      dailySalary,
      deductionType,
      deductionBasis,
      deductionValue,
      dayFraction: event.dayFraction,
    });
    const methodKey = `${deductionType}:${deductionBasis}:${deductionValue}`;
    const method = breakdownByMethod.get(methodKey) || {
      deductionType,
      basis: deductionBasis,
      value: deductionValue,
      count: 0,
      amount: 0,
    };
    method.count += 1;
    method.amount += amountForEvent;
    breakdownByMethod.set(methodKey, method);
    return total + amountForEvent;
  }, 0);
  return {
    count,
    eligibleCount,
    amount,
    breakdown: Array.from(breakdownByMethod.values()),
  };
}

async function calculateSalaryAttendanceDeductions({
  orgId,
  month,
  year,
  employees,
}) {
  if (!orgId) throw new Error("orgId is required.");
  if (!Array.isArray(employees)) throw new Error("employees must be an array.");

  const pool = await getTenantPool(sanitizeDbName(`tenant_${orgId}`));
  await ensurePunchPolicyDeductionSchema(pool);
  const [periodRows] = await pool.execute(
    "SELECT cutoff_date FROM salary_calculation_period WHERE org_id = ? ORDER BY id DESC LIMIT 1",
    [orgId],
  );
  const cutoffDate = Number(periodRows[0]?.cutoff_date || 31);
  const { startDate, endDate } = getPayrollPeriod(month, year, cutoffDate);

  const [policyResult, regularisationResult] = await Promise.all([
    pool.execute(queries.GET_POLICIES, [orgId, endDate, startDate]),
    pool.execute(queries.GET_APPROVED_REGULARISATIONS, [orgId]),
  ]);
  const [policyRows] = policyResult;
  const [regularisationRows] = regularisationResult;

  const policies = groupPolicies(policyRows || []);
  const attendanceStartDate = getAttendanceContextStartDate(
    startDate,
    policies,
  );
  const [attendanceRows] = await pool.execute(queries.GET_ATTENDANCE, [
    orgId,
    attendanceStartDate,
    endDate,
  ]);
  const approvedDates = new Set();
  for (const row of regularisationRows || []) {
    const type = String(row.regularisation_type || "").toLowerCase();
    for (const date of parseSelectedDates(
      row.selected_dates,
      row.primary_date,
    )) {
      approvedDates.add(`${row.employee_id}:${type}:${date}`);
    }
  }

  const employeeInputs = new Map(
    employees
      .filter((employee) => employee && employee.employee_id != null)
      .map((employee) => [
        String(employee.employee_id),
        { annualCtc: Number(employee.annualCtc || employee.annual_ctc || 0) },
      ]),
  );
  const employeeIds = Array.from(employeeInputs.keys());
  let approvedLeaveRows = [];
  if (employeeIds.length) {
    const placeholders = employeeIds.map(() => "?").join(", ");
    const [rows] = await pool.execute(
      queries.GET_APPROVED_LEAVE_SUMMARY.replace(
        "/* employee placeholders */",
        placeholders,
      ),
      [orgId, endDate, startDate, ...employeeIds],
    );
    approvedLeaveRows = rows || [];
  }
  const approvedLeavesByEmployee = new Map(
    approvedLeaveRows.map((row) => [
      String(row.employee_id),
      Number(row.approved_leave_count || 0),
    ]),
  );
  const attendanceByEmployee = new Map();
  for (const row of attendanceRows || []) {
    const employeeId = String(row.employee_id);
    if (!employeeInputs.has(employeeId)) continue;
    if (!attendanceByEmployee.has(employeeId))
      attendanceByEmployee.set(employeeId, []);
    attendanceByEmployee.get(employeeId).push(row);
  }

  const data = {};
  for (const [employeeId, employeeInput] of employeeInputs) {
    const employeeAttendance = attendanceByEmployee.get(employeeId) || [];
    const employee = {
      employee_id: employeeId,
      department_id: employeeAttendance[0]?.department_id,
      department_name: employeeAttendance[0]?.department_name,
    };
    const result = {
      lateLogin: { count: 0, eligibleCount: 0, amount: 0 },
      missPunchOut: { count: 0, eligibleCount: 0, amount: 0 },
      lessLoginHours: { count: 0, eligibleCount: 0, amount: 0 },
      period: { startDate, endDate },
      approvedLeaveCount: approvedLeavesByEmployee.get(employeeId) || 0,
    };
    const typeKeys = {
      late_login: "lateLogin",
      miss_punch_out: "missPunchOut",
      less_login_hours: "lessLoginHours",
    };

    for (const type of POLICY_TYPES) {
      const policy = selectPolicy(employee, policies, type);
      if (!policy) continue;
      const dailyRows = buildDailyAttendance(employeeAttendance, {
        [type]: policy,
      });
      const events = collectEvents(
        employee,
        dailyRows,
        policy,
        type,
        approvedDates,
        {
          startDate,
          endDate,
        },
      );
      result[typeKeys[type]] = getDeduction(
        policy,
        events,
        employeeInput.annualCtc,
        endDate,
      );
    }
    data[employeeId] = result;
  }

  return data;
}

module.exports = {
  calculateSalaryAttendanceDeductions,
  calculateAttendanceDeductionAmount,
  getPayrollPeriod,
};
