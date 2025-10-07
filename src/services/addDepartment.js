const db = require("../config");
const { ADD_DEPARTMENT, GET_DEPARTMENTS } = require("../constants/queries");

const addDepartmentService = async (name, icon, orgId) => {
  try {
    const [results] = await db.query(ADD_DEPARTMENT, [name, icon, orgId]);
    return results;
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new Error("Department already exists");
    }
    throw error;
  }
};

const getDepartmentsService = async (orgId) => {
  try {
    const [results] = await db.query(GET_DEPARTMENTS, [orgId]);
    return results;
  } catch (error) {
    throw error;
  }
};

module.exports = { addDepartmentService, getDepartmentsService };
