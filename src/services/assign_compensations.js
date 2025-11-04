const pool = require("../config");
const queries = require("../constants/assign_compensation");

async function checkEmployeeAssignment(employeeId) {
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.query(queries.CHECK_EMPLOYEE_ASSIGNMENT, [
      JSON.stringify(employeeId),
    ]);
    if (result.length > 0) {
      // Assuming assigned_data contains compensation_plan_name
      const planName = result[0].compensation_plan_name || "Unknown Plan";
      return {
        hasAssignment: true,
        assignmentIds: result.map((row) => row.id),
        compensation_plan_name: planName,
      };
    }
    return {
      hasAssignment: false,
      assignmentIds: [],
      compensation_plan_name: null,
    };
  } catch (err) {
    throw new Error(
      `Error checking assignment for employee ${employeeId}: ${err.message}`
    );
  } finally {
    conn.release();
  }
}

async function assignCompensation({
  employeeId = [],
  departmentIds = [],
  compensationPlanName,
  assignedBy,
  assignedDate,
}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const assignedData = [];
    const directEmployeeSet = new Set(employeeId);
    const deptEmployeeSet = new Set();

    // Fetch employees from selected departments
    if (departmentIds.length > 0) {
      for (const deptId of departmentIds) {
        const [emps] = await conn.query(
          `SELECT employee_id FROM employee_professional WHERE department_id = ?`,
          [deptId]
        );
        for (const { employee_id } of emps) {
          deptEmployeeSet.add(employee_id);
        }
      }
    }

    // Combine both sets
    const allEmployeeSet = new Set([...directEmployeeSet, ...deptEmployeeSet]);

    if (allEmployeeSet.size === 0) {
      throw new Error("No employees selected");
    }

    const allEmployeeIds = [...allEmployeeSet];

    // Check for existing assignments
    const existingAssignments = [];
    for (const empId of allEmployeeIds) {
      const [result] = await conn.query(queries.CHECK_EMPLOYEE_ASSIGNMENT, [
        JSON.stringify(empId),
      ]);
      if (result.length > 0) {
        existingAssignments.push(empId);
      }
    }

    if (existingAssignments.length > 0) {
      throw new Error(
        `Employees with IDs ${existingAssignments.join(
          ", "
        )} already have assignments`
      );
    }

    // Fetch employee names
    const [rows] = await conn.query(
      `SELECT employee_id, CONCAT(first_name, ' ', last_name) AS employee_name
       FROM employees
       WHERE employee_id IN (${allEmployeeIds.map(() => "?").join(",")})`,
      allEmployeeIds
    );

    const nameMap = rows.reduce((map, r) => {
      map[r.employee_id] = r.employee_name;
      return map;
    }, {});

    // Create assignedData array
    for (const empId of allEmployeeIds) {
      assignedData.push({
        type: directEmployeeSet.has(empId) ? "individual" : "department",
        employee_id: empId,
        employee_name: nameMap[empId] || null,
      });
    }

    // Insert assigned data
    await conn.query(queries.ADD_ASSIGNED_COMPENSATION, [
      compensationPlanName,
      JSON.stringify(assignedData),
      assignedBy,
      assignedDate || new Date(),
    ]);

    await conn.commit();
    return { assigned: assignedData.length };
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
    return result.map((row) => ({
      id: row.id,
      compensation_plan_name: row.compensation_plan_name,
    }));
  } catch (err) {
    throw new Error(`Error fetching compensation plans: ${err.message}`);
  } finally {
    conn.release();
  }
}

async function getAssignedCompensationDetails() {
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.query(
      queries.GET_ASSIGNED_COMPENSATION_DETAILS
    );
    return result;
  } catch (err) {
    throw err;
  } finally {
    conn.release();
  }
}

async function addEmployeeBonus({
  percentageCtc,
  percentageMonthlySalary,
  fixedAmount,
  applicableMonth,
}) {
  const [result] = await pool.query(queries.ADD_EMPLOYEE_BONUS, [
    percentageCtc,
    percentageMonthlySalary,
    fixedAmount,
    applicableMonth,
  ]);
  return result;
}

async function addEmployeeBonusBulk({
  percentageCtc,
  percentageMonthlySalary,
  fixedAmount,
  applicableMonth,
}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Fetch skipped employees (those with invalid CTC)
    const [skipped] = await conn.query(
      `SELECT CONCAT(e.first_name, ' ', e.last_name) AS full_name
FROM employees e
JOIN employee_professional ep ON e.employee_id = ep.employee_id
WHERE e.status = 'Active' AND (ep.salary IS NULL OR ep.salary <= 0)
`
    );
    const skippedEmployees = skipped.map((row) => row.full_name);

    // Insert bonuses for all active employees with valid CTC
    const [result] = await conn.query(queries.ADD_EMPLOYEE_BONUS_BULK, [
      percentageCtc,
      percentageMonthlySalary,
      fixedAmount,
      applicableMonth,
    ]);

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

async function getEmployeeBonusDetails() {
  try {
    const [rows] = await pool.query(queries.GET_EMPLOYEE_BONUS_DETAILS);
    return rows;
  } catch (error) {
    console.error("Query failed:", error);
    throw error;
  }
}

async function addEmployeeAdvance({
  employeeId,
  advanceAmount,
  recoveryMonths,
  applicableMonths,
}) {
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
  const [rows] = await pool.query(queries.GET_EMPLOYEE_EXTRA_HOURS, [
    startDate,
    endDate,
  ]);
  return rows;
};

async function addOvertimeDetailsBulk(dataArray) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const values = dataArray.map((row) => [
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
      new Date(),
    ]);

    const [result] = await conn.query(queries.ADD_OVERTIME_DETAILS_BULK, [
      values,
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

async function approveOvertimeRow(row) {
  const [result] = await pool.query(queries.ADD_OVERTIME_DETAILS_APPROVED, [
    row.punch_id,
    row.work_date,
    row.employee_id,
    row.extra_hours,
    row.rate,
    row.project,
    row.supervisor,
    row.comments,
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
    row.comments,
  ]);
  return { success: true, insertId: result.insertId };
}

async function getAllOvertimeDetails() {
  const [rows] = await pool.query(queries.GET_ALL_OVERTIME_DETAILS);
  return rows;
}

async function getEmployeeLopDetailsForCurrentPeriod() {
  try {
    const [rows] = await pool.query(
      queries.GET_EMPLOYEE_LOP_DAYS_FOR_CURRENT_PERIOD
    );
    return rows;
  } catch (err) {
    console.error("Error fetching LOP details:", err);
    throw err;
  }
}

module.exports = {
  checkEmployeeAssignment,
  assignCompensation,

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
