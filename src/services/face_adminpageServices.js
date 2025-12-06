const pool = require("../config");
const queries = require("../constants/face_adminpageQueries");

async function getAllFaces() {
  try {
    const [rows] = await pool.execute(queries.GET_ALL_FACES);
    return rows;
  } catch (error) {
    console.error("❌ Error fetching all faces:", error);
    throw error;
  }
}

async function getLastPunchRecordByEmpId(employeeId) {
  try {
    const [rows] = await pool.execute(queries.GET_LAST_PUNCH, [employeeId]);
    return rows[0];
  } catch (error) {
    console.error("❌ Error fetching last punch record:", error);
    throw error;
  }
}

async function insertPunchIn(
  employeeId,
  punchinTime,
  punchinDevice,
  punchinLocation
) {
  try {
    const [result] = await pool.execute(queries.INSERT_PUNCH_IN, [
      employeeId,
      punchinTime,
      punchinDevice,
      punchinLocation,
    ]);
    return result;
  } catch (error) {
    console.error("❌ Error inserting punch in:", error);
    throw error;
  }
}

async function updatePunchOut(
  punchId,
  punchoutTime,
  punchoutDevice,
  punchoutLocation
) {
  try {
    const [result] = await pool.execute(queries.UPDATE_PUNCH_OUT, [
      punchoutTime,
      punchoutDevice,
      punchoutLocation,
      punchId,
    ]);
    return result;
  } catch (error) {
    console.error("❌ Error updating punch out:", error);
    throw error;
  }
}

module.exports = {
  getAllFaces,
  getLastPunchRecordByEmpId,
  insertPunchIn,
  updatePunchOut,
};
