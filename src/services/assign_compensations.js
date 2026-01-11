const {
  getTenantPool,
  sanitizeDbName,
} = require("../db/tenantPoolManager");

const queries = require("../constants/assign_compensation");

/**
 * Resolve tenant pool (SAME PATTERN AS ASSETS)
 */
async function getTenantPoolForOrgId(orgId) {
  if (!orgId) {
    const err = new Error("orgId required");
    err.code = "ORG_REQUIRED";
    throw err;
  }
  const dbName = sanitizeDbName(`tenant_${orgId}`);
  return getTenantPool(dbName);
}

/**
 * CHECK EMPLOYEE ASSIGNMENT
 */
async function checkEmployeeAssignment(orgId, employeeId) {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const [rows] = await tenantPool.query(
    queries.CHECK_EMPLOYEE_ASSIGNMENT,
    [orgId, employeeId]
  );

  if (rows.length > 0) {
    return {
      hasAssignment: true,
      assignmentIds: rows.map((r) => r.id),
      compensation_plan_name: rows[0].compensation_plan_name,
    };
  }

  return {
    hasAssignment: false,
    assignmentIds: [],
    compensation_plan_name: null,
  };
}

/**
 * ASSIGN COMPENSATION
 */
async function assignCompensation({
  orgId,
  employeeId = [],
  departmentIds = [],
  compensationPlanName,
  assignedBy,
}) {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    const allEmployeeIds = new Set(employeeId);

    // 🔹 Employees from departments
    if (departmentIds.length) {
      for (const deptId of departmentIds) {
        const [rows] = await conn.query(
          `SELECT employee_id FROM employee_professional WHERE department_id = ?`,
          [deptId]
        );
        rows.forEach((r) => allEmployeeIds.add(r.employee_id));
      }
    }

    if (!allEmployeeIds.size) {
      throw new Error("No employees selected");
    }

    // 🔹 Prevent duplicate assignments
    const alreadyAssigned = [];
    for (const empId of allEmployeeIds) {
      const [existing] = await conn.query(
        queries.CHECK_EMPLOYEE_ASSIGNMENT,
        [orgId, empId]
      );
      if (existing.length) alreadyAssigned.push(empId);
    }

    if (alreadyAssigned.length) {
      throw new Error(
        `Employees already assigned plan: ${alreadyAssigned.join(", ")}`
      );
    }

    // 🔹 Fetch employee names
    const [employees] = await conn.query(
      `
      SELECT employee_id,
             CONCAT(first_name,' ',last_name) AS name
      FROM employees
      WHERE employee_id IN (${[...allEmployeeIds].map(() => "?").join(",")})
      `,
      [...allEmployeeIds]
    );

    const nameMap = {};
    employees.forEach((e) => (nameMap[e.employee_id] = e.name));

    const assignedData = [...allEmployeeIds].map((empId) => ({
      employee_id: empId,
      employee_name: nameMap[empId] || null,
    }));

    await conn.query(queries.ADD_ASSIGNED_COMPENSATION, [
      orgId,
      compensationPlanName,
      JSON.stringify(assignedData),
      assignedBy,
    ]);

    await conn.commit();
    return { assignedCount: assignedData.length };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * GET ASSIGNED COMPENSATION
 */
async function getAssignedCompensationDetails(orgId) {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(
    queries.GET_ASSIGNED_COMPENSATION_DETAILS,
    [orgId]
  );
  return rows;
}

/**
 * ADD BONUS (SINGLE)
 */
async function addEmployeeBonus({
  org_id,
  percentageCtc,
  percentageMonthlySalary,
  fixedAmount,
  applicableMonth,
}) {
  const tenantPool = await getTenantPoolForOrgId(org_id);

  const [result] = await tenantPool.query(queries.ADD_EMPLOYEE_BONUS, [
    org_id,
    percentageCtc,
    percentageMonthlySalary,
    fixedAmount,
    applicableMonth,
  ]);

  return result;
}

/**
 * ADD BONUS (BULK)
 */
async function addEmployeeBonusBulk({ orgId, bonusList }) {
  if (!orgId) throw new Error("orgId required");
  if (!Array.isArray(bonusList) || bonusList.length === 0)
    throw new Error("bonusList required");

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    for (const bonus of bonusList) {
      await conn.query(queries.ADD_EMPLOYEE_BONUS_BULK, [
        orgId,
        bonus.percentageCtc || null,
        bonus.percentageMonthlySalary || null,
        bonus.fixedAmount || null,
        bonus.applicableMonth,
      ]);
    }

    await conn.commit();
    return {
      success: true,
      insertedCount: bonusList.length,
    };
  } catch (err) {
    await conn.rollback();
    console.error("❌ addEmployeeBonusBulk failed:", err);
    throw err;
  } finally {
    conn.release();
  }
}



/**
 * BONUS DETAILS
 */
async function getEmployeeBonusDetails(org_id) {
  const tenantPool = await getTenantPoolForOrgId(org_id);
  const [rows] = await tenantPool.query(
    queries.GET_EMPLOYEE_BONUS_DETAILS,
    [org_id]
  );
  return rows;
}

/**
 * ADVANCE
 */
async function addEmployeeAdvance({
  orgId,                // ✅ RECEIVED
  employeeId,
  advanceAmount,
  recoveryMonths,
  applicableMonth,
}) {
  const tenantPool = await getTenantPoolForOrgId(orgId); // ✅ PASS orgId
  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    const [employee] = await conn.query(
      `SELECT employee_id 
       FROM employees 
       WHERE employee_id = ? AND status = 'Active'`,
      [employeeId]
    );

    if (!employee.length) {
      throw new Error("Employee not found or not active");
    }

    const [result] = await conn.query(
      queries.ADD_EMPLOYEE_ADVANCE,
      [
        employeeId,
        advanceAmount,
        recoveryMonths,
        applicableMonth,
      ]
    );

    await conn.commit();
    return {
      success: true,
      affectedRows: result.affectedRows,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}


/**
 * ADVANCE DETAILS
 */
async function getEmployeeAdvanceDetails(orgId) {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(
    queries.GET_EMPLOYEE_ADVANCE_DETAILS
  );
  return rows;
}

/**
 * WORKING DAYS
 */
async function getWorkingDaysCurrentMonth(orgId) {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(
    queries.GET_WORKING_DAYS_CURRENT_MONTH
  );
  return rows[0]?.total_working_days || 0;
}
/**
 * GET ALL OVERTIME DETAILS
 */
async function getAllOvertimeDetails(orgId) {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const [rows] = await tenantPool.query(
    queries.GET_ALL_OVERTIME_DETAILS,
    [orgId]
  );

  return rows;
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
  getWorkingDaysCurrentMonth,
  getAllOvertimeDetails,
};
