const pool = require("../config");
const queries = require("../constants/assign_compensation");


async function checkEmployeeAssignment(orgId, employeeId) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      queries.CHECK_EMPLOYEE_ASSIGNMENT,
      [orgId, employeeId]
    );

    if (rows.length > 0) {
      return {
        hasAssignment: true,
        assignmentIds: rows.map(r => r.id),
        compensation_plan_name: rows[0].compensation_plan_name
      };
    }

    return {
      hasAssignment: false,
      assignmentIds: [],
      compensation_plan_name: null
    };
  } catch (err) {
    throw new Error(err.message);
  } finally {
    conn.release();
  }
}


async function assignCompensation({
  orgId,
  employeeId = [],
  departmentIds = [],
  compensationPlanName,
  assignedBy
}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const allEmployeeIds = new Set(employeeId);

    // 🔹 Fetch employees from departments
    if (departmentIds.length) {
      for (const deptId of departmentIds) {
        const [rows] = await conn.query(
          `SELECT employee_id FROM employee_professional WHERE department_id = ?`,
          [deptId]
        );
        rows.forEach(r => allEmployeeIds.add(r.employee_id));
      }
    }

    if (!allEmployeeIds.size) {
      throw new Error("No employees selected");
    }

    // 🔹 CHECK EXISTING ASSIGNMENTS (ORG-WISE)
   // 🔹 CHECK EXISTING ASSIGNMENTS (ORG-WISE)
const alreadyAssigned = [];
for (const empId of allEmployeeIds) {
  const [existing] = await conn.query(
    queries.CHECK_EMPLOYEE_ASSIGNMENT,
    [orgId, empId]
  );
  if (existing.length) {
    alreadyAssigned.push(empId);
  }
}

if (alreadyAssigned.length) {
  throw new Error(
    `Employees already assigned plan: ${alreadyAssigned.join(', ')}`
  );
}


    // 🔹 Fetch employee names
    const [employees] = await conn.query(
      `SELECT employee_id, CONCAT(first_name,' ',last_name) AS name
       FROM employees
       WHERE employee_id IN (${[...allEmployeeIds].map(() => '?').join(',')})`,
      [...allEmployeeIds]
    );

    const nameMap = {};
    employees.forEach(e => nameMap[e.employee_id] = e.name);

    const assignedData = [...allEmployeeIds].map(empId => ({
      employee_id: empId,
      employee_name: nameMap[empId] || null
    }));

    // 🔹 INSERT WITH org_id
   await conn.query(
  queries.ADD_ASSIGNED_COMPENSATION,
  [
    orgId,
    compensationPlanName,
    JSON.stringify(assignedData),
    assignedBy
  ]
);


    await conn.commit();
    return { assignedCount: assignedData.length };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getCompensationPlans() {
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.query(queries.GET_COMPENSATION_PLANS);
    return result.map(row => ({
      id: row.id,
      compensation_plan_name: row.compensation_plan_name
    }));
  } catch (err) {
    throw new Error(`Error fetching compensation plans: ${err.message}`);
  } finally {
    conn.release();
  }
}

async function getAssignedCompensationDetails(orgId) {
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.query(
      queries.GET_ASSIGNED_COMPENSATION_DETAILS,
      [orgId]
    );
    return result;
  } finally {
    conn.release();
  }
}



async function addEmployeeBonus({
  org_id,
  percentageCtc,
  percentageMonthlySalary,
  fixedAmount,
  applicableMonth,
}) {
  const [result] = await pool.query(
    queries.ADD_EMPLOYEE_BONUS,
    [
      org_id,
      percentageCtc,
      percentageMonthlySalary,
      fixedAmount,
      applicableMonth,
    ]
  );

  return result;
}


async function addEmployeeBonusBulk({
  org_id,
  percentageCtc,
  percentageMonthlySalary,
  fixedAmount,
  applicableMonth,
}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ✅ Skip employees with invalid salary (ORG-WISE)
    const [skipped] = await conn.query(
      `
      SELECT CONCAT(e.first_name, ' ', e.last_name) AS full_name
      FROM employees e
      JOIN employee_professional ep ON e.employee_id = ep.employee_id
      WHERE e.status = 'Active'
        AND e.org_id = ?
        AND (ep.salary IS NULL OR ep.salary <= 0)
      `,
      [org_id]
    );

    const skippedEmployees = skipped.map(row => row.full_name);

    // ✅ Insert bulk bonus
    const [result] = await conn.query(
      queries.ADD_EMPLOYEE_BONUS_BULK,
      [
        org_id,
        percentageCtc,
        percentageMonthlySalary,
        fixedAmount,
        applicableMonth,
      ]
    );

    await conn.commit();
    return {
      success: true,
      affectedRows: result.affectedRows,
      skippedEmployees,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}



async function getEmployeeBonusDetails(org_id) {
  const [rows] = await pool.query(
    queries.GET_EMPLOYEE_BONUS_DETAILS,
    [org_id]
  );
  return rows;
}


async function addEmployeeAdvance({ employeeId, advanceAmount, recoveryMonths, applicableMonths }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Verify employee exists and is active
    const [employee] = await conn.query(
      `SELECT employee_id 
       FROM employees 
       WHERE employee_id = ? AND status = 'Active'`,
      [employeeId]
    );
    if (!employee.length) {
      throw new Error("Employee not found or not active");
    }

    const [result] = await conn.query(queries.ADD_EMPLOYEE_ADVANCE, [
      employeeId,
      advanceAmount,
      recoveryMonths,
      applicableMonths,
    ]);

    await conn.commit();
    return { success: true, affectedRows: result.affectedRows };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getEmployeeAdvanceDetails() {
  const [rows] = await pool.query(queries.GET_EMPLOYEE_ADVANCE_DETAILS);
  return rows;
}

const getEmployeeExtraHoursService = async (startDate, endDate) => {
  const [rows] = await pool.query(queries.GET_EMPLOYEE_EXTRA_HOURS, [startDate, endDate]);

  const grouped = {};

  rows.forEach((row) => {
    const punchin = new Date(row.punchin_time);
    const punchout = new Date(row.punchout_time);
    let current = new Date(punchin);

    while (current < punchout) {
      const dayStart = new Date(current.getFullYear(), current.getMonth(), current.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const sessionStart = new Date(Math.max(current.getTime(), dayStart.getTime()));
      const sessionEnd = new Date(Math.min(punchout.getTime(), dayEnd.getTime()));
      const dayHours = (sessionEnd - sessionStart) / (1000 * 60 * 60);
      const dateStr = dayStart.toISOString().split('T')[0];
      const key = `${row.employee_id}-${dateStr}`;

      if (!grouped[key]) {
        grouped[key] = {
          employee_id: row.employee_id,
          employee_name: row.employee_name || "Unknown", // ✅ Added here
          work_date: dateStr,
          total_hours_worked: 0,
          extra_hours: 0,
          sessions: [],
          projects: new Set(),
          supervisors: new Set(),
          comments: '',
          rate: 0,
        };
      }

      const group = grouped[key];
      group.total_hours_worked += dayHours;

      group.sessions.push({
        punch_id: row.punch_id,
        apportioned_hours: dayHours,
        status: row.status,
      });

if (row.assigned_projects) {
  row.assigned_projects.split(', ').forEach(proj => {
    if (proj.trim()) group.projects.add(proj.trim());
  });
}if (row.supervisor_name) group.supervisors.add(row.supervisor_name);
      if (row.comments) group.comments += (group.comments ? '; ' : '') + row.comments;

      const rowRate = parseFloat(row.rate) || 0;
      group.rate = group.rate === 0 ? rowRate : (group.rate + rowRate) / 2;

      current = dayEnd;
    }
  });

  Object.values(grouped).forEach((group) => {
    const statuses = group.sessions.map(s => s.status);
    const hasApproved = statuses.includes('Approved');
    const hasRejected = statuses.includes('Rejected');
    const hasPending = statuses.includes('Pending');

    if (hasRejected) group.status = 'Rejected';
    else if (hasApproved && !hasPending) group.status = 'Approved';
    else if (hasPending) group.status = 'Pending';
    else group.status = 'Partially Approved';

    group.total_hours_worked = Math.min(group.total_hours_worked, 24);
    group.extra_hours = Math.max(0, group.total_hours_worked - 10);
    group.projects = Array.from(group.projects).join(', ');
    group.supervisors = Array.from(group.supervisors).join(', ');

    const totalApportioned = group.sessions.reduce((sum, s) => sum + s.apportioned_hours, 0);
    group.sessions.forEach((s) => {
      s.extra_hours = totalApportioned > 0
        ? (s.apportioned_hours / totalApportioned) * group.extra_hours
        : 0;
    });
  });

  return Object.values(grouped).filter(g => g.total_hours_worked > 0);
};

async function addOvertimeDetailsBulk(dataArray) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const values = dataArray.map(row => [
      row.punch_id,
      row.work_date,
      row.employee_id,
      row.extra_hours,
      row.rate,
      row.project,
      row.supervisor,
      row.comments,
      row.status,
      new Date(),
      new Date()
    ]);

    const [result] = await conn.query(queries.ADD_OVERTIME_DETAILS_BULK, [values]);
    await conn.commit();
    return { success: true, affectedRows: result.affectedRows };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function approveOvertimeRow(row) {
  const [result] = await pool.query(queries.ADD_OVERTIME_DETAILS_APPROVED, [
    row.punch_id,
    row.work_date,
    row.employee_id,
    row.extra_hours,
    row.rate,
    row.project,
    row.supervisor,
    row.comments
  ]);
  return { success: true, insertId: result.insertId };
}

async function rejectOvertimeRow(row) {
  const [result] = await pool.query(queries.ADD_OVERTIME_DETAILS_REJECTED, [
    row.punch_id,
    row.work_date,
    row.employee_id,
    row.extra_hours,
    row.rate,
    row.project,
    row.supervisor,
    row.comments
  ]);
  return { success: true, insertId: result.insertId };
}

async function getAllOvertimeDetails() {
  const [rows] = await pool.query(queries.GET_ALL_OVERTIME_DETAILS);
  return rows;
}

async function getEmployeeLopDetailsForCurrentPeriod() {
  try {
    const [rows] = await pool.query(queries.GET_EMPLOYEE_LOP_DAYS_FOR_CURRENT_PERIOD);
    return rows;
  } catch (err) {
    console.error("Error fetching LOP details:", err);
    throw err;
  }
}

async function getWorkingDaysCurrentMonth() {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(queries.GET_WORKING_DAYS_CURRENT_MONTH);
    return rows[0]?.total_working_days || 0;
  } catch (err) {
    console.error("Error fetching working days:", err);
    throw err;
  } finally {
    conn.release();
  }
}


module.exports = {
  checkEmployeeAssignment,
  assignCompensation,
   getWorkingDaysCurrentMonth, 
  getAssignedCompensationDetails,
  addEmployeeBonus,
  addEmployeeBonusBulk,
  getEmployeeBonusDetails,
  addEmployeeAdvance,
  getEmployeeAdvanceDetails,
  getEmployeeExtraHoursService,
  addOvertimeDetailsBulk,
  approveOvertimeRow,
  rejectOvertimeRow,
  getAllOvertimeDetails,
  getEmployeeLopDetailsForCurrentPeriod,
};