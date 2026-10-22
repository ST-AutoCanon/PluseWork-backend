const bcrypt = require("bcrypt");
const db = require("../config");
const queries = require("../constants/commonLoginQueries");

const {
  getTenantPool,
  sanitizeDbName,
} = require("../db/tenantPoolManager");

async function getTenantPoolForOrgId(orgId) {
  if (!orgId) {
    throw new Error("orgId required to get tenant pool");
  }

  const dbName = sanitizeDbName(`tenant_${orgId}`);

  return getTenantPool(dbName);
}

class CommonLoginService {
  // ============================================================
  // GET COMMON LOGIN BY EMAIL
  // ============================================================

  static async getLoginByEmail(orgId, email) {
    if (!orgId) {
      throw new Error("orgId is required");
    }

    if (!email) {
      return null;
    }

    const tenantPool = await getTenantPoolForOrgId(orgId);

    const [rows] = await tenantPool.query(
      queries.GET_COMMON_LOGIN_BY_EMAIL,
      [orgId, email.trim()],
    );

    return rows?.[0] || null;
  }

  // ============================================================
  // GET COMMON LOGIN BY EMPLOYEE ID
  // ============================================================

  static async getLoginByEmployeeId(orgId, employeeId) {
    if (!orgId) {
      throw new Error("orgId is required");
    }

    if (!employeeId) {
      return null;
    }

    const tenantPool = await getTenantPoolForOrgId(orgId);

    const [rows] = await tenantPool.query(
      queries.GET_COMMON_LOGIN_BY_EMPLOYEE_ID,
      [orgId, employeeId],
    );

    return rows?.[0] || null;
  }

  // ============================================================
  // CREATE COMMON LOGIN
  // ============================================================

 static async createCommonLogin({
  orgId,
  name,
  email,
  password,
  location,
  pincode,
  isActive = true,
}) {
  if (!orgId) {
    throw new Error("orgId is required");
  }

  if (!name || !email || !password) {
    throw new Error("name, email and password are required");
  }

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const passwordHash = await bcrypt.hash(password, 12);

  const [result] = await tenantPool.query(
    queries.INSERT_COMMON_LOGIN,
    [
      orgId,
      name.trim(),
      email.trim(),
      passwordHash,
      location?.trim() || null,
      pincode?.trim() || null,
      isActive ? 1 : 0,
    ]
  );

  return {
    id: result.insertId,
    orgId,
    name: name.trim(),
    email: email.trim(),
    location: location?.trim() || null,
    pincode: pincode?.trim() || null,
    isActive: Boolean(isActive),
  };
}

  // ============================================================
  // UPDATE COMMON LOGIN
  // ============================================================

  static async updateCommonLogin({
    id,
    orgId,
    name,
    email,
    password,
    location,
    pincode,
    isActive = 1,
  }) {
    if (!id || !orgId) {
      throw new Error("id and orgId are required");
    }

    const tenantPool = await getTenantPoolForOrgId(orgId);

    let passwordHash = null;

    if (password) {
      passwordHash = await bcrypt.hash(password, 12);
    }

    if (password) {
      const [result] = await tenantPool.query(
        queries.UPDATE_COMMON_LOGIN,
        [
          name || null,
          email || null,
          passwordHash,
          location || null,
          pincode || null,
          isActive ? 1 : 0,
          id,
          orgId,
        ],
      );

      return result;
    }

    const updateQuery = `
      UPDATE common_login
      SET
        name = ?,
        email = ?,
        location = ?,
        pincode = ?,
        is_active = ?
      WHERE id = ?
        AND org_id = ?
    `;

    const [result] = await tenantPool.query(
      updateQuery,
      [
        name || null,
        email || null,
        location || null,
        pincode || null,
        isActive ? 1 : 0,
        id,
        orgId,
      ],
    );

    return result;
  }

  // ============================================================
  // UPDATE PASSWORD
  // ============================================================

  static async updatePassword({
    id,
    orgId,
    password,
  }) {
    if (!id || !orgId || !password) {
      throw new Error(
        "id, orgId and password are required",
      );
    }

    const tenantPool = await getTenantPoolForOrgId(orgId);

    const passwordHash = await bcrypt.hash(password, 12);

    const [result] = await tenantPool.query(
      queries.UPDATE_COMMON_LOGIN_PASSWORD,
      [
        passwordHash,
        id,
        orgId,
      ],
    );

    return result;
  }

  // ============================================================
  // DISABLE LOGIN
  // ============================================================

  static async disableLogin(id, orgId) {
    const tenantPool = await getTenantPoolForOrgId(orgId);

    const [result] = await tenantPool.query(
      queries.DISABLE_COMMON_LOGIN,
      [id, orgId],
    );

    return result;
  }

  // ============================================================
  // ENABLE LOGIN
  // ============================================================

  static async enableLogin(id, orgId) {
    const tenantPool = await getTenantPoolForOrgId(orgId);

    const [result] = await tenantPool.query(
      queries.ENABLE_COMMON_LOGIN,
      [id, orgId],
    );

    return result;
  }

  // ============================================================
  // VERIFY PASSWORD
  // ============================================================

  static async verifyPassword(password, passwordHash) {
    if (!password || !passwordHash) {
      return false;
    }

    return bcrypt.compare(password, passwordHash);
  }

  // ============================================================
  // GET ORGANIZATION
  // ============================================================

  static async getOrganization(orgId) {
    if (!orgId) {
      return null;
    }

    const [rows] = await db.execute(
      queries.GET_ORGANIZATION,
      [orgId],
    );

    return rows?.[0] || null;
  }

  // ============================================================
  // SAVE DEVICE
  // ============================================================

  static async saveDevice({
    loginId,
    orgId,
    employeeId,
    deviceName,
    deviceType,
    browser,
    ipAddress,
    location,
  }) {
    if (!loginId || !orgId || !employeeId) {
      throw new Error(
        "loginId, orgId and employeeId are required",
      );
    }

    const tenantPool = await getTenantPoolForOrgId(orgId);

    const [result] = await tenantPool.query(
      queries.INSERT_DEVICE,
      [
        loginId,
        orgId,
        employeeId,
        deviceName || null,
        deviceType || "Other",
        browser || null,
        ipAddress || null,
        location || null,
      ],
    );

    return result;
  }

  // ============================================================
  // GET DEVICES
  // ============================================================

  static async getDevices(loginId, orgId) {
    const tenantPool = await getTenantPoolForOrgId(orgId);

    const [rows] = await tenantPool.query(
      queries.GET_DEVICES_BY_LOGIN,
      [loginId, orgId],
    );

    return rows || [];
  }

  // ============================================================
  // DELETE DEVICE
  // ============================================================

static async getAllCommonLogins(orgId) {
  if (!orgId) {
    throw new Error("orgId is required");
  }

  const tenantPool = await getTenantPoolForOrgId(orgId);

  const [rows] = await tenantPool.query(
    `SELECT
       id,
       org_id,
       employee_id,
       name,
       email,
       location,
       pincode,
       is_active
     FROM common_login
     WHERE org_id = ?
     ORDER BY id DESC`,
    [orgId]
  );

  return rows;
}

static async getCommonLoginById(id, orgId) {
  if (!id || !orgId) {
    throw new Error("id and orgId are required");
  }

  const tenantPool = await getTenantPoolForOrgId(orgId);

  const [rows] = await tenantPool.query(
    `SELECT
       id,
       org_id,
       employee_id,
       name,
       email,
       location,
       pincode,
       is_active
     FROM common_login
     WHERE id = ? AND org_id = ?
     LIMIT 1`,
    [id, orgId]
  );

  return rows[0] || null;
}

  static async deleteDevice(deviceId, orgId) {
    const tenantPool = await getTenantPoolForOrgId(orgId);

    const [result] = await tenantPool.query(
      queries.DELETE_DEVICE,
      [deviceId, orgId],
    );

    return result;
  }
}

module.exports = CommonLoginService;