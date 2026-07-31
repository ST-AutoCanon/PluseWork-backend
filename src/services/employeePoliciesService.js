const {
  GET_EMPLOYEE_POLICIES,
  GET_POLICY_FILES,
  GET_POLICY_FILE_BY_ID,
  SAVE_ACKNOWLEDGEMENT,
  CHECK_ACKNOWLEDGEMENT,
  GET_EMPLOYEE_POLICY_HISTORY,
} = require("../constants/employeePolicies");

const {
  getTenantPool,
  sanitizeDbName,
} = require("../db/tenantPoolManager");

async function getTenantPoolForOrgId(orgId) {
  if (!orgId) {
    const err = new Error("orgId required to get tenant pool");
    err.code = "ORG_REQUIRED";
    throw err;
  }

  const dbName = sanitizeDbName(`tenant_${orgId}`);
  return getTenantPool(dbName);
}

/* ==========================================================
   Get Employee Assigned Policies
========================================================== */

/* ==========================================================
   Get Employee Assigned Policies
========================================================== */

const getEmployeePolicies = async (orgId, employeeId) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);

    const [rows] = await tenantPool.query(
      GET_EMPLOYEE_POLICIES,
      [employeeId, orgId]
    );

    return rows;
  } catch (error) {
    console.error("❌ Error fetching employee policies:", error);
    throw new Error("Failed to fetch employee policies");
  }
};

/* ==========================================================
   Get Files By Policy
========================================================== */

const getPolicyFiles = async (
  orgId,
  policyId
) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);

    const [rows] = await tenantPool.query(
      GET_POLICY_FILES,
      [
        policyId,
        orgId,
      ]
    );

    return rows;
  } catch (error) {
    console.error("❌ Error fetching policy files:", error);
    throw new Error("Failed to fetch policy files");
  }
};

/* ==========================================================
   Get Single Policy File
========================================================== */

const getPolicyFileById = async (
  orgId,
  fileId
) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);

    const [rows] = await tenantPool.query(
      GET_POLICY_FILE_BY_ID,
      [
        fileId,
        orgId,
      ]
    );

    return rows.length ? rows[0] : null;
  } catch (error) {
    console.error("❌ Error fetching policy file:", error);
    throw new Error("Failed to fetch policy file");
  }
};

/* ==========================================================
   Check Acknowledgement
========================================================== */

const checkAcknowledgement = async (
  orgId,
  employeeId,
  policyFileId
) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);

    const [rows] = await tenantPool.query(
      CHECK_ACKNOWLEDGEMENT,
      [
        orgId,
        employeeId,
        policyFileId,
      ]
    );

    return rows.length ? rows[0] : null;
  } catch (error) {
    console.error("❌ Error checking acknowledgement:", error);
    throw new Error("Failed to check acknowledgement");
  }
};

/* ==========================================================
   Save Acknowledgement
========================================================== */

const saveAcknowledgement = async (
  orgId,
  employeeId,
  policyId,
  policyFileId
) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);

    const existing = await checkAcknowledgement(
      orgId,
      employeeId,
      policyFileId
    );

    if (existing) {
      return "already_acknowledged";
    }

    await tenantPool.query(
      SAVE_ACKNOWLEDGEMENT,
      [
        orgId,
        employeeId,
        policyId,
        policyFileId,
      ]
    );

    return "saved";
  } catch (error) {
    console.error("❌ Error saving acknowledgement:", error);
    throw new Error("Failed to save acknowledgement");
  }
};

/* ==========================================================
   Employee Policy History
========================================================== */

const getEmployeePolicyHistory = async (
  orgId,
  employeeId
) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);

    const [rows] = await tenantPool.query(
      GET_EMPLOYEE_POLICY_HISTORY,
      [
        orgId,
        employeeId,
      ]
    );

    return rows;
  } catch (error) {
    console.error("❌ Error fetching acknowledgement history:", error);
    throw new Error("Failed to fetch acknowledgement history");
  }
};

module.exports = {
  getEmployeePolicies,
  getPolicyFiles,
  getPolicyFileById,
  checkAcknowledgement,
  saveAcknowledgement,
  getEmployeePolicyHistory,
};