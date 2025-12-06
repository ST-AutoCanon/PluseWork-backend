const db = require("../config");
const { CHECK_FACE_EXISTS } = require("../constants/checkFaceQuery");

const checkFaceExists = async (employee_id) => {
  const [rows] = await db.execute(CHECK_FACE_EXISTS, [employee_id]);
  return rows.length > 0;
};

module.exports = {
  checkFaceExists,
};
