// services/reg_faceService.js
const db = require("../config"); // Assuming you have a db.js for DB connection
const { CHECK_FACE_REGISTERED } = require("../constants/reg_faceConstants");
const checkFaceRegistered = async (employeeId) => {
  try {
    const [rows] = await db.execute(CHECK_FACE_REGISTERED, [employeeId]);
    return rows.length > 0; // if data exists, return true
  } catch (error) {
    console.error("Error in checking face registration:", error);
    throw new Error("Database error");
  }
};

module.exports = { checkFaceRegistered };
