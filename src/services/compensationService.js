
const db = require("../config");
const {
  INSERT_COMPENSATION_PLAN,
  INSERT_COMPENSATION_WORKING_DAYS,
  GET_ALL_COMPENSATION_PLANS,
  GET_COMPENSATION_PLAN_BY_ID,
  GET_COMPENSATION_WORKING_DAYS_BY_PLAN_ID,
  UPDATE_COMPENSATION_PLAN,
  UPDATE_COMPENSATION_WORKING_DAYS,
  DELETE_COMPENSATION,
  DELETE_COMPENSATION_WORKING_DAYS,
  GET_ALL_EMPLOYEE_FULL_NAMES,
  GET_ALL_DEPARTMENT_NAMES,
  GET_EMPLOYEES_BY_DEPARTMENT_ID,
  INSERT_TDS_SLAB,
  GET_TDS_SLABS_BY_MONTH_YEAR,
  GET_PREVIOUS_TDS_SLABS,
} = require("../constants/compensationPlans");

const getLastCompensationId = async () => {
  try {
    const [rows] = await db.execute("SELECT MAX(CAST(SUBSTRING(id, 6) AS UNSIGNED)) as maxId FROM compensation_plans WHERE id REGEXP '^COMP-[0-9]{3}$'");
    const lastNum = rows[0].maxId || 0;
    const nextNum = lastNum + 1;
    return `COMP-${String(nextNum).padStart(3, '0')}`;
  } catch (error) {
    console.error("❌ Error fetching last compensation ID:", error);
    throw new Error("Failed to generate compensation ID");
  }
};

const addCompensation = async (compData) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { compensationPlanName, formData, org_id } = compData;

    const values = [
      compensationPlanName,
      JSON.stringify(formData),
      org_id
    ];

    const [result] = await connection.execute(
      INSERT_COMPENSATION_PLAN,
      values
    );

    const planId = result.insertId;

    const workingDays = formData.defaultWorkingDays || {};
    const workingDaysValues = [
      planId,
      workingDays.Sunday || 'weekOff',
      workingDays.Monday || 'fullDay',
      workingDays.Tuesday || 'fullDay',
      workingDays.Wednesday || 'fullDay',
      workingDays.Thursday || 'fullDay',
      workingDays.Friday || 'fullDay',
      workingDays.Saturday || 'weekOff'
    ];

    await connection.execute(
      INSERT_COMPENSATION_WORKING_DAYS,
      workingDaysValues
    );

    await connection.commit();
    return { insertId: planId, org_id };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};


const getAllCompensations = async (org_id) => {
  const [rows] = await db.execute(
    GET_ALL_COMPENSATION_PLANS,
    [org_id]
  );
  return rows;
};


const getCompensationByEmployeeId = async (id) => {
  try {
    console.log("Fetching compensation with id:", id, "Query:", GET_COMPENSATION_PLAN_BY_ID);
    const [rows] = await db.execute(GET_COMPENSATION_PLAN_BY_ID, [id]);
    return rows;
  } catch (error) {
    console.error("❌ Error fetching compensation by ID:", error);
    throw new Error("Failed to fetch compensation");
  }
};

const getCompensationWorkingDaysByPlanId = async (planId) => {
  try {
    console.log("Fetching working days for plan id:", planId, "Query:", GET_COMPENSATION_WORKING_DAYS_BY_PLAN_ID);
    const [rows] = await db.execute(GET_COMPENSATION_WORKING_DAYS_BY_PLAN_ID, [planId]);
    return rows;
  } catch (error) {
    console.error("❌ Error fetching compensation working days:", error);
    throw new Error("Failed to fetch compensation working days");
  }
};

const updateCompensation = async (compensation_id, updateData) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { compensationPlanName, formData } = updateData;
    const values = [compensationPlanName, JSON.stringify(formData), compensation_id];
    console.log('Executing UPDATE_COMPENSATION_PLAN with values:', values);
    const [result] = await connection.execute(UPDATE_COMPENSATION_PLAN, values);

    const workingDays = formData.defaultWorkingDays || {};
    const workingDaysValues = [
      workingDays.Sunday || 'weekOff',
      workingDays.Monday || 'fullDay',
      workingDays.Tuesday || 'fullDay',
      workingDays.Wednesday || 'fullDay',
      workingDays.Thursday || 'fullDay',
      workingDays.Friday || 'fullDay',
      workingDays.Saturday || 'weekOff',
      compensation_id
    ];
    console.log('Executing UPDATE_COMPENSATION_WORKING_DAYS with values:', workingDaysValues);
    await connection.execute(UPDATE_COMPENSATION_WORKING_DAYS, workingDaysValues);

    await connection.commit();
    return { affectedRows: result.affectedRows };
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error updating compensation:', error);
    throw new Error('Failed to update compensation');
  } finally {
    connection.release();
  }
};

const deleteCompensation = async (compensation_id) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    console.log("Executing DELETE_COMPENSATION_WORKING_DAYS with id:", compensation_id);
    await connection.execute(DELETE_COMPENSATION_WORKING_DAYS, [compensation_id]);
    
    console.log("Executing DELETE_COMPENSATION with id:", compensation_id);
    await connection.execute(DELETE_COMPENSATION, [compensation_id]);
    
    await connection.commit();
    return "deleted";
  } catch (error) {
    await connection.rollback();
    console.error("❌ Error deleting compensation:", error);
    throw new Error("Failed to delete compensation");
  } finally {
    connection.release();
  }
};

// Fetch all employee full names
const getAllEmployeeNames = async (orgId) => {
  const [rows] = await db.query(GET_ALL_EMPLOYEE_FULL_NAMES, [orgId]);
  return rows;
};


const getAllDepartmentNames = async () => {
  try {
    const [rows] = await db.execute(GET_ALL_DEPARTMENT_NAMES);
    return rows;
  } catch (error) {
    console.error("❌ Error fetching department names:", error);
    throw new Error("Failed to fetch department names");
  }
};

// const getEmployeesByDepartmentId = async (departmentId) => {
//   try {
//     const [rows] = await db.execute(GET_EMPLOYEES_BY_DEPARTMENT_ID, [departmentId]);
//     return rows;
//   } catch (error) {
//     console.error("❌ Error fetching employees by department ID:", error);
//     throw new Error("Failed to fetch employees by department");
//   }
// };
const getEmployeesByDepartmentId = async (departmentId, orgId) => {
  const [rows] = await db.execute(
    GET_EMPLOYEES_BY_DEPARTMENT_ID,
    [departmentId, orgId]
  );
  return rows;
};

const addTdsSlab = async ({ slab_from, slab_to, percentage, month, year }) => {
  try {
    const values = [slab_from, slab_to, percentage, month, year];
    console.log("Executing INSERT_TDS_SLAB with values:", values);
    const [result] = await db.execute(INSERT_TDS_SLAB, values);
    return { insertId: result.insertId };
  } catch (error) {
    console.error("❌ Error adding TDS slab:", error);
    throw new Error("Failed to add TDS slab");
  }
};

const getTdsSlabsByMonthYear = async (month, year) => {
  try {
    console.log("Executing GET_TDS_SLABS_BY_MONTH_YEAR with values:", [month, year]);
    const [rows] = await db.execute(GET_TDS_SLABS_BY_MONTH_YEAR, [month, year]);
    return rows;
  } catch (error) {
    console.error("❌ Error fetching TDS slabs:", error);
    throw new Error("Failed to fetch TDS slabs");
  }
};

const getPreviousTdsSlabs = async (month, year) => {
  try {
    console.log("Executing GET_PREVIOUS_TDS_SLABS with values:", [year, year, month]);
    const [rows] = await db.execute(GET_PREVIOUS_TDS_SLABS, [year, year, month]);
    return rows;
  } catch (error) {
    console.error("❌ Error fetching previous TDS slabs:", error);
    throw new Error("Failed to fetch previous TDS slabs");
  }
};



module.exports = {
  getLastCompensationId,
  addCompensation,
  getAllCompensations,
  getCompensationByEmployeeId,
  getCompensationWorkingDaysByPlanId,
  updateCompensation,
  deleteCompensation,
  getAllEmployeeNames,
  getAllDepartmentNames,
  getEmployeesByDepartmentId,
  addTdsSlab,
  getTdsSlabsByMonthYear,
  getPreviousTdsSlabs
};