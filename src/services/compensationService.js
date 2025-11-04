const db = require("../config");
const {
  INSERT_COMPENSATION_PLAN,
  GET_ALL_COMPENSATION_PLANS,
  GET_COMPENSATION_PLAN_BY_ID,
  UPDATE_COMPENSATION_PLAN,
  DELETE_COMPENSATION,
  GET_LAST_COMPENSATION_ID,
  GET_ALL_EMPLOYEE_FULL_NAMES,
  GET_ALL_DEPARTMENT_NAMES,
  GET_EMPLOYEES_BY_DEPARTMENT_ID,
} = require("../constants/compensationPlans");

const getLastCompensationId = async () => {
  try {
    const [rows] = await db.execute(
      "SELECT MAX(CAST(SUBSTRING(id, 6) AS UNSIGNED)) as maxId FROM compensation_plans WHERE id REGEXP '^COMP-[0-9]{3}$'"
    );
    const lastNum = rows[0].maxId || 0;
    const nextNum = lastNum + 1;
    return `COMP-${String(nextNum).padStart(3, "0")}`;
  } catch (error) {
    console.error("❌ Error fetching last compensation ID:", error);
    throw new Error("Failed to generate compensation ID");
  }
};

const addCompensation = async (compData) => {
  try {
    const compensation_id = await getLastCompensationId();
    const { compensationPlanName, formData } = compData;
    const values = [compensationPlanName, JSON.stringify(formData)];
    const [result] = await db.execute(INSERT_COMPENSATION_PLAN, values);
    return { compensation_id, insertId: result.insertId };
  } catch (error) {
    console.error("❌ Error adding compensation plan:", error);
    throw new Error("Failed to add compensation plan");
  }
};

const getAllCompensations = async () => {
  try {
    const [rows] = await db.execute(GET_ALL_COMPENSATION_PLANS);
    return rows;
  } catch (error) {
    console.error("❌ Error fetching all compensations:", error);
    throw new Error("Failed to fetch compensations");
  }
};
const getCompensationByEmployeeId = async (id) => {
  try {
    const [rows] = await db.execute(GET_COMPENSATION_PLAN_BY_ID, [id]);
    return rows;
  } catch (error) {
    console.error("❌ Error fetching compensation by ID:", error);
    throw new Error("Failed to fetch compensation");
  }
};

const updateCompensation = async (compensation_id, updateData) => {
  try {
    const { compensationPlanName, formData } = updateData;
    const values = [
      compensationPlanName,
      JSON.stringify(formData),
      compensation_id,
    ];
    const [result] = await db.execute(UPDATE_COMPENSATION_PLAN, values); // Error here
    return { affectedRows: result.affectedRows };
  } catch (error) {
    console.error("❌ Error updating compensation:", error);
    throw new Error("Failed to update compensation");
  }
};

const deleteCompensation = async (compensation_id) => {
  try {
    await db.execute(DELETE_COMPENSATION, [compensation_id]);
    return "deleted";
  } catch (error) {
    console.error("❌ Error deleting compensation:", error);
    throw new Error("Failed to delete compensation");
  }
};

// Fetch all employee full names
const getAllEmployeeNames = async () => {
  try {
    const [rows] = await db.execute(GET_ALL_EMPLOYEE_FULL_NAMES);
    return rows;
  } catch (error) {
    console.error("❌ Error fetching employee names:", error);
    throw new Error("Failed to fetch employee names");
  }
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
const getEmployeesByDepartmentId = async (departmentId) => {
  try {
    const [rows] = await db.execute(GET_EMPLOYEES_BY_DEPARTMENT_ID, [
      departmentId,
    ]);
    return rows;
  } catch (error) {
    console.error("❌ Error fetching employees by department ID:", error);
    throw new Error("Failed to fetch employees by department");
  }
};
module.exports = {
  getLastCompensationId,
  addCompensation,
  getAllCompensations,
  getCompensationByEmployeeId,
  updateCompensation,
  deleteCompensation,
  getAllEmployeeNames,
  getAllDepartmentNames,
  getEmployeesByDepartmentId,
};
