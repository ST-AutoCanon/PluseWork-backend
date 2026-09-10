const queries = require("../constants/vendorQueries");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { sendVendorRegistrationEmail, sendVendorApprovalEmail } = require("./vendorRegistrationEmail");
const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");

async function getTenantPoolForOrgId(orgId) {
  if (!orgId) {
    throw new Error("org_id header is required");
  }
  try {
    return await getTenantPoolByOrgId(orgId);
  } catch (poolError) {
    console.error(`Failed to connect to tenant database for org ${orgId}:`, poolError);
    if (
      poolError.code === "ER_BAD_DB_ERROR" ||
      poolError.message.includes("Unknown database")
    ) {
      throw new Error("Organization not found");
    }
    throw poolError;
  }
}

async function ensureRegistrationInviteTable(tenantPool) {
  await tenantPool.query(`
    CREATE TABLE IF NOT EXISTS vendor_registration_invites (
      invite_id int NOT NULL AUTO_INCREMENT,
      token_hash char(64) NOT NULL,
      vendor_name varchar(255) NOT NULL,
      username varchar(255) NOT NULL,
      password_hash varchar(255) NOT NULL,
      org_id int NOT NULL,
      expires_at datetime NOT NULL,
      used_at datetime DEFAULT NULL,
      created_by varchar(50) DEFAULT NULL,
      created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (invite_id),
      UNIQUE KEY uq_vendor_registration_token (token_hash),
      KEY idx_vendor_registration_expiry (expires_at)
    )`);
  const [columns] = await tenantPool.query(
    "SHOW COLUMNS FROM vendor_registration_invites"
  );
  const existingColumns = new Set(columns.map(({ Field }) => Field));
  const missingColumns = [
    ["username", "varchar(255) NULL"],
    ["password_hash", "varchar(255) NULL"],
    ["submission_data", "JSON NULL"],
    ["submitted_at", "datetime NULL"],
    ["status", "varchar(20) NOT NULL DEFAULT 'sent'"],
  ];

  for (const [column, definition] of missingColumns) {
    if (existingColumns.has(column)) continue;
    await tenantPool.query(
      `ALTER TABLE vendor_registration_invites ADD COLUMN ${column} ${definition}`
    );
  }
}

const insertVendor = async (vendorData, orgId) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const params = [orgId, ...vendorData];
    const [result] = await tenantPool.query(queries.INSERT_VENDOR, params);
    return result;
  } catch (error) {
    console.error("❌ Error inserting vendor:", error);
    if (error.message === "Organization not found") {
      throw error;
    }
    throw new Error("Failed to add vendor");
  }
};

const getVendorsByOrgId = async (orgId) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [rows] = await tenantPool.query(queries.GET_VENDORS_BY_ORGID, [
      orgId,
    ]);
    return rows;
  } catch (error) {
    console.error("❌ Error fetching vendors:", error);
    if (error.message === "Organization not found") {
      throw error;
    }
    throw new Error("Failed to retrieve vendors");
  }
};

const getVendorById = async (vendor_id, orgId) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [rows] = await tenantPool.query(queries.GET_VENDOR_BY_ID, [
      vendor_id,
      orgId,
    ]);
    return rows.length ? rows[0] : null;
  } catch (error) {
    console.error("❌ Error fetching vendor by id:", error);
    if (error.message === "Organization not found") {
      throw error;
    }
    throw new Error("Failed to retrieve vendor");
  }
};

const updateVendorById = async (vendorData, vendor_id, orgId) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const params = [...vendorData, vendor_id, orgId];
    const [result] = await tenantPool.query(
      queries.UPDATE_VENDOR_BY_ID,
      params
    );
    return result;
  } catch (error) {
    console.error("❌ Error updating vendor:", error);
    if (error.message === "Organization not found") {
      throw error;
    }
    throw new Error("Failed to update vendor");
  }
};

const createRegistrationInvite = async ({ vendorName, recipientEmail, orgId, createdBy }) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  await ensureRegistrationInviteTable(tenantPool);
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const username = recipientEmail.trim().toLowerCase();
  const password = crypto.randomBytes(9).toString("hex");
  const passwordHash = await bcrypt.hash(password, 10);
  const expiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

  await tenantPool.query(
    `INSERT INTO vendor_registration_invites
      (token_hash, vendor_name, username, password_hash, org_id, expires_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tokenHash, vendorName, username, passwordHash, orgId, expiresAt, createdBy || null]
  );
  return { token, tokenHash, expiresAt, username, password };
};

const sendRegistrationInvite = async ({ vendorName, recipientEmail, subject, body, orgId, createdBy }) => {
  const invite = await createRegistrationInvite({ vendorName, recipientEmail, orgId, createdBy });
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const link = `${frontendUrl}/vendor-registration?orgId=${encodeURIComponent(orgId)}&token=${invite.token}`;
  try {
    await sendVendorRegistrationEmail({
      recipientEmail,
      vendorName,
      subject,
      body,
      link,
      username: invite.username,
      password: invite.password,
    });
  } catch (error) {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    await tenantPool.query(
      "DELETE FROM vendor_registration_invites WHERE token_hash = ?",
      [invite.tokenHash]
    );
    throw error;
  }
  return { expiresAt: invite.expiresAt };
};

const getRegistrationInvite = async (token, orgId) => {
  if (!token || !orgId) {
    console.warn("[getRegistrationInvite] missing token or orgId");
    return null;
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  console.log("[getRegistrationInvite] looking up", { orgId, tokenHash: tokenHash.slice(0, 12) + "..." });

  const tenantPool = await getTenantPoolForOrgId(orgId);
  await ensureRegistrationInviteTable(tenantPool);

  const [rows] = await tenantPool.query(
    `SELECT invite_id, vendor_name, username, password_hash, org_id, expires_at, used_at, status
       FROM vendor_registration_invites
      WHERE token_hash = ? AND org_id = ? LIMIT 1`,
    [tokenHash, orgId]
  );

  const invite = rows[0];
  if (!invite) {
    console.warn("[getRegistrationInvite] no row found");
    return null;
  }
  if (invite.used_at) {
    console.warn("[getRegistrationInvite] already used", { used_at: invite.used_at });
    const error = new Error("Vendor registration has already been submitted");
    error.code = "ALREADY_SUBMITTED";
    throw error;
  }
  if (invite.status === "pending" || invite.status === "approved") {
    console.warn("[getRegistrationInvite] registration already submitted", {
      status: invite.status,
    });
    const error = new Error("Vendor registration has already been submitted");
    error.code = "ALREADY_SUBMITTED";
    throw error;
  }
  if (new Date(invite.expires_at) <= new Date()) {
    console.warn("[getRegistrationInvite] expired", { expires_at: invite.expires_at });
    return null;
  }

  console.log("[getRegistrationInvite] valid invite found", {
    vendor_name: invite.vendor_name,
    expires_at: invite.expires_at,
  });

  return { ...invite, tokenHash };
};

const authenticateRegistrationInvite = async ({ token, orgId, username, password }) => {
  console.log("[authenticateRegistrationInvite] start", { orgId, username, hasToken: !!token });

  const invite = await getRegistrationInvite(token, orgId);
  if (!invite) {
    console.warn("[authenticateRegistrationInvite] invite not found or expired");
    return null;
  }

  if (!invite.password_hash || !invite.username) {
    const error = new Error(
      "This invitation was created before login credentials were enabled. Please request a new invitation."
    );
    error.code = "LEGACY_INVITE";
    throw error;
  }

  if (username?.trim().toLowerCase() !== invite.username) {
    console.warn("[authenticateRegistrationInvite] username mismatch", {
      received: username?.trim().toLowerCase(),
      expected: invite.username,
    });
    return null;
  }

  const validPassword = await bcrypt.compare(password || "", invite.password_hash);
  console.log("[authenticateRegistrationInvite] password check", { valid: validPassword });

  return validPassword ? invite : null;
};

const completeRegistration = async ({ token, orgId, username, password, data }) => {
  const invite = await authenticateRegistrationInvite({ token, orgId, username, password });
  if (!invite) throw new Error("Registration link is invalid or expired");
  if (!/^\d+$/.test(String(data.years_of_experience || "")) || Number(data.years_of_experience) < 1) {
    const error = new Error("Years of experience must be a whole number greater than 0");
    error.code = "INVALID_VENDOR_DATA";
    throw error;
  }
  const tenantPool = await getTenantPoolForOrgId(orgId);
  await ensureRegistrationInviteTable(tenantPool);
  await tenantPool.query(
    `UPDATE vendor_registration_invites
        SET submission_data = ?, submitted_at = NOW(), status = 'pending'
      WHERE token_hash = ? AND used_at IS NULL`,
    [JSON.stringify(data), invite.tokenHash]
  );
};

const getPendingRegistrations = async (orgId) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  await ensureRegistrationInviteTable(tenantPool);
  const [rows] = await tenantPool.query(
    `SELECT invite_id, vendor_name, username, status, submitted_at, created_at,
            submission_data AS submitted_data
       FROM vendor_registration_invites
      WHERE org_id = ? AND status IN ('pending', 'rejected')
      ORDER BY submitted_at DESC, invite_id DESC`,
    [orgId]
  );
  return rows.map((row) => ({
    ...row,
    submitted_data:
      typeof row.submitted_data === "string"
        ? JSON.parse(row.submitted_data)
        : row.submitted_data || {},
  }));
};

const approveRegistration = async (inviteId, orgId) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  await ensureRegistrationInviteTable(tenantPool);
  const [rows] = await tenantPool.query(
    `SELECT * FROM vendor_registration_invites
      WHERE invite_id = ? AND org_id = ? AND status = 'pending' LIMIT 1`,
    [inviteId, orgId]
  );
  const request = rows[0];
  if (!request) throw new Error("Registration request not found");

  const data = typeof request.submission_data === "string"
    ? JSON.parse(request.submission_data)
    : request.submission_data || {};
  const vendorData = [
    data.company_name || request.vendor_name,
    data.registered_address || null, data.city || null, data.state || null,
    data.pin_code || null, data.gst_number || null, data.pan_number || null,
    data.company_type || null, data.contact1_name || null,
    data.contact1_designation || null, data.contact1_mobile || null,
    data.contact1_email || null, data.contact2_name || null,
    data.contact2_designation || null, data.contact2_mobile || null,
    data.contact2_email || null, data.contact3_name || null,
    data.contact3_designation || null, data.contact3_mobile || null,
    data.contact3_email || null, data.bank_name || null, data.branch || null,
    data.branch_address || null, data.account_number || null,
    data.ifsc_code || null, data.nature_of_business || null,
    data.product_category || null, data.years_of_experience || null,
    data.gst_certificate || null, data.pan_card || null,
    data.cancelled_cheque || null, data.msme_certificate || null,
    data.msme_status || "Not Applicable", data.incorporation_certificate || null,
  ];
  const result = await insertVendor(vendorData, orgId);
  await tenantPool.query(
    `UPDATE vendor_registration_invites
        SET used_at = NOW(), status = 'approved'
      WHERE invite_id = ? AND org_id = ?`,
    [inviteId, orgId]
  );
  return result;
};

const rejectRegistration = async (inviteId, orgId) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  await ensureRegistrationInviteTable(tenantPool);
  const [result] = await tenantPool.query(
    `UPDATE vendor_registration_invites
        SET status = 'rejected'
      WHERE invite_id = ? AND org_id = ? AND status = 'pending'`,
    [inviteId, orgId]
  );
  if (!result.affectedRows) throw new Error("Registration request not found");
};

const sendApprovalEmail = async (inviteId, orgId) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  await ensureRegistrationInviteTable(tenantPool);
  const [rows] = await tenantPool.query(
    `SELECT vendor_name, username, submission_data
       FROM vendor_registration_invites
      WHERE invite_id = ? AND org_id = ? AND status = 'approved' LIMIT 1`,
    [inviteId, orgId]
  );
  const request = rows[0];
  if (!request) throw new Error("Approved registration not found");
  const data = typeof request.submission_data === "string"
    ? JSON.parse(request.submission_data)
    : request.submission_data || {};
  const recipientEmail = data.contact1_email || request.username;
  if (!recipientEmail) throw new Error("Vendor email address not found");
  await sendVendorApprovalEmail({ recipientEmail, vendorName: data.company_name || request.vendor_name });
};

module.exports = {
  insertVendor,
  getVendorsByOrgId,
  getVendorById,
  updateVendorById,
  sendRegistrationInvite,
  getRegistrationInvite,
  authenticateRegistrationInvite,
  completeRegistration,
  getPendingRegistrations,
  approveRegistration,
  rejectRegistration,
  sendApprovalEmail,
};
