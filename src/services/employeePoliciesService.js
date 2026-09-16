const {
  GET_EMPLOYEE_POLICIES,
  GET_POLICY_FILES,
  GET_POLICY_FILE_BY_ID,
  SAVE_ACKNOWLEDGEMENT,
  CHECK_ACKNOWLEDGEMENT,
  SAVE_READ_COMPLETION,
  GET_POLICY_READING_STATUS,
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

async function ensurePolicyTrackingSchema(tenantPool) {
  const [columns] = await tenantPool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'policy_acknowledgements'
       AND COLUMN_NAME IN ('read_completed', 'read_at')`
  );
  const existing = new Set(columns.map((column) => column.COLUMN_NAME));
  if (!existing.has("read_completed")) {
    await tenantPool.query(
      "ALTER TABLE policy_acknowledgements ADD COLUMN read_completed TINYINT(1) NOT NULL DEFAULT 0"
    );
  }
  if (!existing.has("read_at")) {
    await tenantPool.query(
      "ALTER TABLE policy_acknowledgements ADD COLUMN read_at TIMESTAMP NULL DEFAULT NULL"
    );
  }
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

const getPolicyFiles = async (orgId, policyId, employeeId) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    await ensurePolicyTrackingSchema(tenantPool);

    const [rows] = await tenantPool.query(
      GET_POLICY_FILES,
      [
        employeeId,   // for LEFT JOIN
        orgId,        // for LEFT JOIN
        policyId,
        orgId
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
    await ensurePolicyTrackingSchema(tenantPool);

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

    if (existing && Number(existing.acknowledged) === 1) {
      return "already_acknowledged";
    }

    if (existing) {
      await tenantPool.query(
        `UPDATE policy_acknowledgements
         SET acknowledged = 1, acknowledged_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [existing.id]
      );
      return "saved";
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

const saveReadCompletion = async (orgId, employeeId, policyId, policyFileId) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  await ensurePolicyTrackingSchema(tenantPool);
  const [result] = await tenantPool.query(SAVE_READ_COMPLETION, [orgId, employeeId, policyId, policyFileId]);
  if (result.affectedRows === 0) {
    await tenantPool.query(
      `INSERT INTO policy_acknowledgements
       (org_id, employee_id, policy_id, policy_file_id, read_completed, read_at)
       VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
      [orgId, employeeId, policyId, policyFileId]
    );
  }
};

const getPolicyReadingStatus = async (orgId, policyId) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  await ensurePolicyTrackingSchema(tenantPool);
  const [rows] = await tenantPool.query(GET_POLICY_READING_STATUS, [
    policyId, policyId, orgId, policyId, orgId, policyId, orgId,
  ]);
  return rows.map((row) => ({
    employee_id: row.employee_id,
    employee_name: row.employee_name || `Employee ${row.employee_id}`,
    read: Number(row.total_files) > 0 && Number(row.read_files) === Number(row.total_files),
    acknowledged: Number(row.required_ack_files) > 0 &&
      Number(row.acknowledged_files) === Number(row.required_ack_files),
  }));
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
  saveReadCompletion,
  getPolicyReadingStatus,
  getEmployeePolicyHistory,
};