


const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const queries = require("../constants/face_adminpageQueries");



const getAllFaces = async (orgId) => {
  if (!orgId) throw new Error("orgId is required for getAllFaces");

  const tenantPool = await getTenantPoolByOrgId(orgId);
  const [rows] = await tenantPool.execute(queries.GET_ALL_FACES);


  return rows || [];
};

const getLastPunchRecordByEmpId = async (employeeId, orgId) => {
  if (!orgId) throw new Error("orgId is required for getLastPunchRecordByEmpId");
  if (!employeeId) throw new Error("employeeId is required");

  const tenantPool = await getTenantPoolByOrgId(orgId);
  const [rows] = await tenantPool.execute(queries.GET_LAST_PUNCH, [employeeId]);

  return rows[0] || null; 
};

const insertPunchIn = async (
  employeeId,
  punchinTime,
  punchinDevice,
  punchinLocation,
  orgId
) => {
  if (!orgId) throw new Error("orgId is required for insertPunchIn");
  if (!employeeId || !punchinTime) {
    throw new Error("employeeId and punchinTime are required");
  }

  const tenantPool = await getTenantPoolByOrgId(orgId);
  const [result] = await tenantPool.execute(queries.INSERT_PUNCH_IN, [
    employeeId,
    punchinTime,
    punchinDevice || null,
    punchinLocation || null,
  ]);

  return result;
};

const updatePunchOut = async (
  punchId,
  punchoutTime,
  punchoutDevice,
  punchoutLocation,
  orgId
) => {
  if (!orgId) throw new Error("orgId is required for updatePunchOut");
  if (!punchId || !punchoutTime) {
    throw new Error("punchId and punchoutTime are required");
  }

  const tenantPool = await getTenantPoolByOrgId(orgId);
  const [result] = await tenantPool.execute(queries.UPDATE_PUNCH_OUT, [
    punchoutTime,
    punchoutDevice || null,
    punchoutLocation || null,
    punchId,
  ]);

  return result;
};

module.exports = {
  getAllFaces,
  getLastPunchRecordByEmpId,
  insertPunchIn,
  updatePunchOut,
};