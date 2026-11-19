const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");
const { getPayrollPeriod } = require("./salaryAttendanceDeductionService");

function formatDate(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function toDateKey(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getDatesBetween(startDate, endDate) {
  const dates = [];
  const current = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (current <= end) {
    dates.push(formatDate(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function getMonthYear(dateKey) {
  const [year, month] = dateKey.split("-");
  return `${month}-${year}`;
}

function getSelectedSaturdayDates(dateKeys, saturdayRows) {
  const settingsByMonth = new Map(
    saturdayRows.map((row) => [
      String(row.month_year),
      new Set(
        String(row.saturdays || "")
          .split(",")
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isInteger(value) && value > 0),
      ),
    ]),
  );
  const selectedDates = new Set();

  for (const dateKey of dateKeys) {
    const date = new Date(`${dateKey}T00:00:00Z`);
    if (date.getUTCDay() !== 6) continue;

    const monthYear = getMonthYear(dateKey);
    const position = Math.ceil(date.getUTCDate() / 7);
    if (settingsByMonth.get(monthYear)?.has(position)) {
      selectedDates.add(dateKey);
    }
  }

  return selectedDates;
}

async function calculateSalaryWorkedDays({
  orgId,
  month,
  year,
  asOfDate,
  employees,
}) {
  if (!orgId) throw new Error("orgId is required.");
  if (!Array.isArray(employees)) throw new Error("employees must be an array.");

  const employeeIds = Array.from(
    new Set(
      employees
        .filter((employee) => employee?.employee_id != null)
        .map((employee) => String(employee.employee_id)),
    ),
  );
  const pool = await getTenantPool(sanitizeDbName(`tenant_${orgId}`));
  const [periodRows] = await pool.execute(
    "SELECT cutoff_date FROM salary_calculation_period WHERE org_id = ? ORDER BY id DESC LIMIT 1",
    [orgId],
  );
  const cutoffDate = Number(periodRows[0]?.cutoff_date || 31);
  const today = asOfDate || toDateKey(new Date());
  const todayDay = Number(today.slice(8, 10));
  const requestedMonth = Number(month);
  const requestedYear = Number(year);
  const targetMonthDate = new Date(
    Date.UTC(
      requestedYear,
      requestedMonth - 1 + (todayDay > cutoffDate ? 1 : 0),
      1,
    ),
  );
  const period = getPayrollPeriod(
    targetMonthDate.getUTCMonth() + 1,
    targetMonthDate.getUTCFullYear(),
    cutoffDate,
  );
  const endDate = period.endDate < today ? period.endDate : today;
  const dateKeys =
    period.startDate <= endDate
      ? getDatesBetween(period.startDate, endDate)
      : [];
  const employeeIdSet = new Set(employeeIds);

  if (!employeeIds.length || !dateKeys.length) {
    return {
      period: { ...period, endDate, cutoffDate },
      employees: employeeIds.map((employeeId) => ({
        employee_id: employeeId,
        totalWorkingDays: 0,
        workedDays: 0,
        approvedLeaveDays: 0,
        absentDays: 0,
        dailyStatus: [],
      })),
    };
  }

  const placeholders = employeeIds.map(() => "?").join(", ");
  const monthKeys = Array.from(new Set(dateKeys.map(getMonthYear)));
  const monthPlaceholders = monthKeys.map(() => "?").join(", ");
  const [attendanceResult, leaveResult, pendingLeaveResult, holidayResult, saturdayResult] =
    await Promise.all([
      pool.execute(
        `SELECT
           ea.employee_id,
           DATE(COALESCE(ea.punchin_time, ea.punchout_time)) AS attendance_date,
           TIME_FORMAT(MIN(ea.punchin_time), '%H:%i') AS first_punch_in,
           TIME_FORMAT(MAX(ea.punchout_time), '%H:%i') AS last_punch_out
         FROM emp_attendence ea
         INNER JOIN employees e ON e.employee_id = ea.employee_id
         WHERE e.org_id = ?
           AND ea.employee_id IN (${placeholders})
           AND DATE(COALESCE(ea.punchin_time, ea.punchout_time)) BETWEEN ? AND ?
         GROUP BY ea.employee_id, DATE(COALESCE(ea.punchin_time, ea.punchout_time))`,
        [orgId, ...employeeIds, period.startDate, endDate],
      ),
      pool.execute(
        `SELECT employee_id, start_date, end_date, H_F_day
         FROM leavequeries
         WHERE org_id = ?
           AND status = 'Approved'
           AND employee_id IN (${placeholders})
           AND start_date <= ?
           AND end_date >= ?`,
        [orgId, ...employeeIds, endDate, period.startDate],
      ),
      pool.execute(
        `SELECT employee_id, start_date, end_date, H_F_day
         FROM leavequeries
         WHERE org_id = ?
           AND status = 'Pending'
           AND employee_id IN (${placeholders})
           AND start_date <= ?
           AND end_date >= ?`,
        [orgId, ...employeeIds, endDate, period.startDate],
      ),
      pool.execute(
        "SELECT date FROM holidays WHERE org_id = ? AND date BETWEEN ? AND ?",
        [orgId, period.startDate, endDate],
      ),
      pool.execute(
        `SELECT month_year, saturdays
         FROM saturday_holidays
         WHERE month_year IN (${monthPlaceholders})`,
        monthKeys,
      ),
    ]);

  const [attendanceRows] = attendanceResult;
  const [leaveRows] = leaveResult;
  const [pendingLeaveRows] = pendingLeaveResult;
  const [holidayRows] = holidayResult;
  const [saturdayRows] = saturdayResult;
  const attendanceByEmployee = new Map();
  for (const row of attendanceRows || []) {
    const employeeId = String(row.employee_id);
    const date = toDateKey(row.attendance_date);
    if (!date || !employeeIdSet.has(employeeId)) continue;
    if (!attendanceByEmployee.has(employeeId)) {
      attendanceByEmployee.set(employeeId, new Map());
    }
    attendanceByEmployee.get(employeeId).set(date, {
      firstPunchIn: row.first_punch_in || null,
      lastPunchOut: row.last_punch_out || null,
    });
  }

  const leaveFractionsByEmployee = new Map();
  for (const row of leaveRows || []) {
    const employeeId = String(row.employee_id);
    if (!leaveFractionsByEmployee.has(employeeId)) {
      leaveFractionsByEmployee.set(employeeId, new Map());
    }
    const leaveDates = leaveFractionsByEmployee.get(employeeId);
    const startDate = toDateKey(row.start_date);
    const leaveEndDate = toDateKey(row.end_date);
    if (!startDate || !leaveEndDate) continue;
    const halfDay =
      startDate === leaveEndDate &&
      String(row.H_F_day || "").toLowerCase().includes("half");
    for (const date of getDatesBetween(
      startDate < period.startDate ? period.startDate : startDate,
      leaveEndDate > endDate ? endDate : leaveEndDate,
    )) {
      leaveDates.set(
        date,
        Math.min(1, (leaveDates.get(date) || 0) + (halfDay ? 0.5 : 1)),
      );
    }
  }

  const pendingLeaveDatesByEmployee = new Map();
  for (const row of pendingLeaveRows || []) {
    const employeeId = String(row.employee_id);
    if (!pendingLeaveDatesByEmployee.has(employeeId)) {
      pendingLeaveDatesByEmployee.set(employeeId, new Set());
    }
    const startDate = toDateKey(row.start_date);
    const leaveEndDate = toDateKey(row.end_date);
    if (!startDate || !leaveEndDate) continue;
    for (const date of getDatesBetween(
      startDate < period.startDate ? period.startDate : startDate,
      leaveEndDate > endDate ? endDate : leaveEndDate,
    )) {
      pendingLeaveDatesByEmployee.get(employeeId).add(date);
    }
  }

  const holidays = new Set(
    (holidayRows || []).map((row) => toDateKey(row.date)).filter(Boolean),
  );
  const saturdayHolidays = getSelectedSaturdayDates(dateKeys, saturdayRows || []);
  const workingDateKeys = dateKeys.filter((date) => {
    return !holidays.has(date) && !saturdayHolidays.has(date);
  });

  return {
    period: { ...period, endDate, cutoffDate },
    employees: employeeIds.map((employeeId) => {
      const attendance = attendanceByEmployee.get(employeeId) || new Map();
      const leaveDates = leaveFractionsByEmployee.get(employeeId) || new Map();
      const pendingLeaveDates =
        pendingLeaveDatesByEmployee.get(employeeId) || new Set();
      let workedDays = 0;
      let approvedLeaveDays = 0;
      let absentDays = 0;
      const dailyStatus = workingDateKeys.map((date) => {
        const punches = attendance.get(date);
        let status;
        if (punches?.firstPunchIn || punches?.lastPunchOut) {
          status = "Present";
          workedDays += 1;
        } else if (leaveDates.has(date)) {
          const leaveFraction = leaveDates.get(date);
          status = "Approved Leave";
          approvedLeaveDays += leaveFraction;
          absentDays += 1 - leaveFraction;
        } else if (pendingLeaveDates.has(date)) {
          status = "Pending Leave";
          absentDays += 1;
        } else {
          status = "Absent";
          absentDays += 1;
        }
        return {
          date,
          status,
          leaveDays: leaveDates.get(date) || 0,
          punchIn: punches?.firstPunchIn || null,
          punchOut: punches?.lastPunchOut || null,
        };
      });

      return {
        employee_id: employeeId,
        totalWorkingDays: workingDateKeys.length,
        workedDays: Number(workedDays.toFixed(2)),
        approvedLeaveDays: Number(approvedLeaveDays.toFixed(2)),
        absentDays: Number(absentDays.toFixed(2)),
        dailyStatus,
      };
    }),
  };
}

module.exports = { calculateSalaryWorkedDays };
