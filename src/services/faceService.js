const db = require("../config");
const {
  INSERT_FACE_DATA,
  GET_EMPLOYEE_NAME,
} = require("../constants/faceQueries");

async function getEmployeeName(employee_id) {
  const [rows] = await db.query(GET_EMPLOYEE_NAME, [employee_id]);
  return rows.length > 0 ? rows[0].first_name : null;
}

async function saveFaceData(employee_id, label, descriptors) {
  return await db.query(INSERT_FACE_DATA, [
    employee_id,
    label,
    JSON.stringify(descriptors),
  ]);
}

module.exports = {
  getEmployeeName,
  saveFaceData,
};
