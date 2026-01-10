

const attendanceQueries = require("../constants/attendanceQueries");
const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");

async function getTenantPoolForOrgId(orgId) {
  if (!orgId) {
    const err = new Error("orgId required to get tenant pool");
    err.code = "ORG_REQUIRED";
    throw err;
  }
  const dbName = sanitizeDbName(`tenant_${orgId}`);
  return getTenantPool(dbName);
}

const attendanceService = {
  getEmployeeAttendance: async (employeeId, orgId) => {
    const db = await getTenantPoolForOrgId(orgId);
    const [rows] = await db.execute(
      attendanceQueries.GET_EMPLOYEE_ATTENDANCE,
      [employeeId]
    );
    return rows;
  },

  addPunchIn: async (employeeId, device, location, punchMode, orgId) => {
    const db = await getTenantPoolForOrgId(orgId);
    const [result] = await db.execute(
      attendanceQueries.ADD_PUNCH_IN,
      [employeeId, device, location, punchMode]
    );
    return result.insertId;
  },

  updatePunchOut: async (employeeId, device, location, punchMode, orgId) => {
    const db = await getTenantPoolForOrgId(orgId);
    const [result] = await db.execute(
      attendanceQueries.UPDATE_PUNCH_OUT,
      [device, location, punchMode, employeeId]
    );
    return result.affectedRows;
  },

  getTodayAttendance: async (orgId) => {
    const db = await getTenantPoolForOrgId(orgId);
    const [rows] = await db.execute(
      attendanceQueries.GET_TODAY_ATTENDANCE
    );
    return rows;
  },

  getLastPunchStatus: async (employeeId, orgId) => {
    const db = await getTenantPoolForOrgId(orgId);
    const [rows] = await db.execute(
      attendanceQueries.GET_LAST_PUNCH_STATUS,
      [employeeId]
    );
    return rows.length ? rows[0].punch_status : null;
  },

  getLatestPunchIn: async (employeeId, orgId) => {
    const db = await getTenantPoolForOrgId(orgId);
    const [rows] = await db.execute(attendanceQueries.GET_LATEST_PUNCH_IN, [
      employeeId,
    ]);
    return rows.length ? rows[0] : null;
  },

  getLatestPunchOut: async (employeeId, orgId) => {
    const db = await getTenantPoolForOrgId(orgId);
    const [rows] = await db.execute(attendanceQueries.GET_LATEST_PUNCH_OUT, [
      employeeId,
    ]);
    return rows.length ? rows[0] : null;
  },

  fetchLatestPunchRecord: async (employeeId, orgId) => {
    const db = await getTenantPoolForOrgId(orgId);
    const [rows] = await db.execute(
      `
      SELECT employee_id, punch_status,
             punchin_time, punchin_device, punchin_location,
             punchout_time, punchout_device, punchout_location,
             punchmode
      FROM emp_attendence
      WHERE employee_id = ?
      ORDER BY GREATEST(
        COALESCE(punchin_time, '0000-00-00'),
        COALESCE(punchout_time, '0000-00-00')
      ) DESC
      LIMIT 1
      `,
      [employeeId]
    );
    return rows.length ? rows[0] : null;
  },
};

module.exports = attendanceService;
