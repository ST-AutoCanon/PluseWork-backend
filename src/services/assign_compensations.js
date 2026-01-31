const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");

const queries = require("../constants/assign_compensation");
async function getEmployeeExtraHoursService(orgId, startDate, endDate) {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const [rows] = await tenantPool.query(
    queries.GET_EMPLOYEE_EXTRA_HOURS,
    [startDate, endDate]
  );

  return rows;
}

async function getTenantPoolForOrgId(orgId) {
  if (!orgId) {
    const err = new Error("orgId required");
    err.code = "ORG_REQUIRED";
    throw err;
  }
  const dbName = sanitizeDbName(`tenant_${orgId}`);
  return getTenantPool(dbName);
}

async function checkEmployeeAssignment(orgId, employeeId) {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const [rows] = await tenantPool.query(queries.CHECK_EMPLOYEE_ASSIGNMENT, [
    orgId,
    employeeId,
  ]);

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
async function addOvertimeDetailsBulk(orgId, dataArray) {
  if (!orgId) throw new Error("orgId required");
  if (!Array.isArray(dataArray) || !dataArray.length)
    throw new Error("Valid dataArray required");

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    // Prepare bulk data for insert
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
      orgId,
      new Date(),
      new Date(),
    ]);

    // Use single insert query for bulk operation
    const query = `
      INSERT INTO overtime_details (
        punch_id,
        work_date,
        employee_id,
        extra_hours,
        rate,
        project,
        supervisor,
        comments,
        status,
        org_id,
        created_at,
        updated_at
      )
      VALUES ?
      ON DUPLICATE KEY UPDATE
        extra_hours = VALUES(extra_hours),
        rate = VALUES(rate),
        project = VALUES(project),
        supervisor = VALUES(supervisor),
        comments = VALUES(comments),
        status = COALESCE(VALUES(status), overtime_details.status),
        updated_at = CURRENT_TIMESTAMP
    `;

    await conn.query(query, [values]);

    await conn.commit();
    return { insertedCount: dataArray.length };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

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

    const alreadyAssigned = [];
    for (const empId of allEmployeeIds) {
      const [existing] = await conn.query(queries.CHECK_EMPLOYEE_ASSIGNMENT, [
        orgId,
        empId,
      ]);
      if (existing.length) alreadyAssigned.push(empId);
    }

    if (alreadyAssigned.length) {
      throw new Error(
        `Employees already assigned plan: ${alreadyAssigned.join(", ")}`
      );
    }

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

async function getAssignedCompensationDetails(orgId) {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(
    queries.GET_ASSIGNED_COMPENSATION_DETAILS,
    [orgId]
  );
  return rows;
}

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

async function getEmployeeBonusDetails(org_id) {
  const tenantPool = await getTenantPoolForOrgId(org_id);
  const [rows] = await tenantPool.query(queries.GET_EMPLOYEE_BONUS_DETAILS, [
    org_id,
  ]);
  return rows;
}

async function addEmployeeAdvance({
  orgId,
  employeeId,
  advanceAmount,
  recoveryMonths,
  applicableMonth,
}) {
  const tenantPool = await getTenantPoolForOrgId(orgId);
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

    const [result] = await conn.query(queries.ADD_EMPLOYEE_ADVANCE, [
      employeeId,
      advanceAmount,
      recoveryMonths,
      applicableMonth,
    ]);

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

async function getEmployeeAdvanceDetails(orgId) {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(queries.GET_EMPLOYEE_ADVANCE_DETAILS);
  return rows;
}

async function getWorkingDaysCurrentMonth(orgId) {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(queries.GET_WORKING_DAYS_CURRENT_MONTH);
  return rows[0]?.total_working_days || 0;
}

async function getAllOvertimeDetails(orgId) {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const [rows] = await tenantPool.query(queries.GET_ALL_OVERTIME_DETAILS, [
    orgId,
  ]);

  return rows;
}

async function approveOvertimeRow(orgId, row) {
  if (!orgId) throw new Error("orgId required");
  if (!row || !row.punch_id) throw new Error("punch_id required");

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    // Update the overtime_details record to 'Approved' status
    const [result] = await conn.query(
      `UPDATE overtime_details 
       SET status = 'Approved', 
           updated_at = CURRENT_TIMESTAMP 
       WHERE punch_id = ?`,
      [row.punch_id]
    );

    // If no record exists, insert it
    if (result.affectedRows === 0) {
      const [insertResult] = await conn.query(
        `INSERT INTO overtime_details 
         (punch_id, work_date, employee_id, extra_hours, rate, project, supervisor, comments, status, org_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Approved', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          row.punch_id,
          row.work_date,
          row.employee_id,
          row.extra_hours,
          row.rate,
          row.project,
          row.supervisor,
          row.comments,
          orgId,
        ]
      );
      await conn.commit();
      return { success: true, insertId: insertResult.insertId };
    }

    await conn.commit();
    return { success: true, affectedRows: result.affectedRows };
  } catch (err) {
    await conn.rollback();
    console.error("❌ approveOvertimeRow failed:", err);
    throw err;
  } finally {
    conn.release();
  }
}

async function rejectOvertimeRow(orgId, row) {
  if (!orgId) throw new Error("orgId required");
  if (!row || !row.punch_id) throw new Error("punch_id required");

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    // Update the overtime_details record to 'Rejected' status
    const [result] = await conn.query(
      `UPDATE overtime_details 
       SET status = 'Rejected', 
           updated_at = CURRENT_TIMESTAMP 
       WHERE punch_id = ?`,
      [row.punch_id]
    );

    // If no record exists, insert it
    if (result.affectedRows === 0) {
      const [insertResult] = await conn.query(
        `INSERT INTO overtime_details 
         (punch_id, work_date, employee_id, extra_hours, rate, project, supervisor, comments, status, org_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Rejected', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          row.punch_id,
          row.work_date,
          row.employee_id,
          row.extra_hours,
          row.rate,
          row.project,
          row.supervisor,
          row.comments,
          orgId,
        ]
      );
      await conn.commit();
      return { success: true, insertId: insertResult.insertId };
    }

    await conn.commit();
    return { success: true, affectedRows: result.affectedRows };
  } catch (err) {
    await conn.rollback();
    console.error("❌ rejectOvertimeRow failed:", err);
    throw err;
  } finally {
    conn.release();
  }
}

async function getEmployeeLopDetailsForCurrentPeriod(orgId) {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  
  try {
    const [rows] = await tenantPool.query(
      `SELECT * FROM loss_of_pay WHERE org_id = ? AND MONTH(applicable_date) = MONTH(CURDATE()) AND YEAR(applicable_date) = YEAR(CURDATE())`,
      [orgId]
    );
    return rows;
  } catch (err) {
    console.error("❌ getEmployeeLopDetailsForCurrentPeriod failed:", err);
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
  getWorkingDaysCurrentMonth,
  getAllOvertimeDetails,
  getEmployeeExtraHoursService,
  approveOvertimeRow,
  rejectOvertimeRow,
  getEmployeeLopDetailsForCurrentPeriod,
  addOvertimeDetailsBulk,
};
