const db = require("../config");
const { CHECK_FACE_REGISTERED } = require("../constants/reg_faceConstants");
const checkFaceRegistered = async (employeeId) => {
  try {
    const [rows] = await db.execute(CHECK_FACE_REGISTERED, [employeeId]);
    return rows.length > 0;
  } catch (error) {
    console.error("Error in checking face registration:", error);
    throw new Error("Database error");
  }
};

module.exports = { checkFaceRegistered };
