const vendorService = require("../services/vendorService");
const path = require("path");
const fs = require("fs");

const getOrgIdFromHeaders = (req) => {
  return (
    req.headers.org_id ||
    req.headers["org-id"] ||
    req.headers["x-org-id"] ||
    req.headers["x-organization-id"] ||
    (req.body && req.body.orgId) ||
    (req.query && req.query.orgId) ||
    null
  );
};

const addVendorHandler = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);
  if (!orgId) {
    return res.status(400).json({ message: "org_id header is required" });
  }

  try {
    const {
      company_name,
      registered_address,
      city,
      state,
      pin_code,
      gst_number,
      pan_number,
      company_type,
      contact1_name,
      contact1_designation,
      contact1_mobile,
      contact1_email,
      contact2_name,
      contact2_designation,
      contact2_mobile,
      contact2_email,
      contact3_name,
      contact3_designation,
      contact3_mobile,
      contact3_email,
      bank_name,
      branch,
      branch_address,
      account_number,
      ifsc_code,
      nature_of_business,
      product_category,
      years_of_experience,
      msme_status,
    } = req.body;

    if (!company_name) {
      return res.status(400).json({ message: "Company name is required" });
    }

    const files = req.files || {};

    const gst_certificate = files.gst_certificate?.[0]?.path || null;
    const pan_card = files.pan_card?.[0]?.path || null;
    const cancelled_cheque = files.cancelled_cheque?.[0]?.path || null;
    const msme_certificate = files.msme_certificate?.[0]?.path || null;
    const incorporation_certificate =
      files.incorporation_certificate?.[0]?.path || null;

    const vendorData = [
      company_name || null,
      registered_address || null,
      city || null,
      state || null,
      pin_code || null,
      gst_number || null,
      pan_number || null,
      company_type || null,
      contact1_name || null,
      contact1_designation || null,
      contact1_mobile || null,
      contact1_email || null,
      contact2_name || null,
      contact2_designation || null,
      contact2_mobile || null,
      contact2_email || null,
      contact3_name || null,
      contact3_designation || null,
      contact3_mobile || null,
      contact3_email || null,
      bank_name || null,
      branch || null,
      branch_address || null,
      account_number || null,
      ifsc_code || null,
      nature_of_business || null,
      product_category || null,
      years_of_experience || null,
      gst_certificate,
      pan_card,
      cancelled_cheque,
      msme_certificate,
      msme_status || null,
      incorporation_certificate,
    ];

    const result = await vendorService.insertVendor(vendorData, orgId);

    res.status(201).json({
      success: true,
      message: "Vendor added successfully",
      result,
    });
  } catch (error) {
    console.error("❌ Error adding vendor:", error);
    if (error.message === "Organization not found") {
      return res.status(404).json({ message: "Organization not found" });
    }
    res.status(500).json({ message: "Failed to add vendor" });
  }
};

const sendVendorRegistrationInviteHandler = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);
  const { vendorName, recipientEmail, subject, body } = req.body || {};
  if (!orgId || !vendorName || !recipientEmail || !subject || !body) {
    return res.status(400).json({ message: "Vendor name, recipient email, subject and body are required" });
  }
  try {
    const result = await vendorService.sendRegistrationInvite({
      vendorName: vendorName.trim(),
      recipientEmail: recipientEmail.trim(),
      subject: subject.trim(),
      body: body.trim(),
      orgId,
      createdBy: req.headers["x-employee-id"],
    });
    res.status(201).json({ success: true, message: "Registration email sent", expiresAt: result.expiresAt });
  } catch (error) {
    console.error("Error sending vendor registration invite:", error);
    const providerError = error.response?.body || error.body || {};
    const providerMessage = providerError.message || error.message;
    const isUnauthorized =
      providerError.code === "unauthorized" ||
      providerError.code === "Unauthorized" ||
      providerMessage?.toLowerCase() === "unauthorized";

    if (error.code === "EDNS") {
      return res.status(502).json({
        message: "Email server hostname could not be resolved. Check SMTP_HOST in the backend .env file.",
      });
    }

    if (isUnauthorized) {
      const isIpRestriction = providerMessage?.toLowerCase().includes("ip");
      return res.status(502).json({
        message: isIpRestriction
          ? "Brevo rejected this server IP. Remove the Brevo IP restriction or allow this server IP in Brevo API settings."
          : "Brevo rejected the API credentials. Check BREVO_API_KEY and verify BREVO_SENDER_EMAIL in Brevo.",
        providerCode: providerError.code || "unauthorized",
      });
    }

    res.status(502).json({
      message: providerMessage || "Failed to send registration email",
    });
  }
};

const loginPublicVendorRegistrationHandler = async (req, res) => {
  const { token, orgId, username, password } = req.body || {};

  console.log("[loginPublicVendorRegistration] incoming", {
    hasToken: !!token,
    orgId,
    username,
    hasPassword: !!password,
  });

  try {
    const invite = await vendorService.authenticateRegistrationInvite({
      token,
      orgId,
      username,
      password,
    });

    if (!invite) {
      console.warn("[loginPublicVendorRegistration] auth failed – invalid credentials");
      return res.status(401).json({ message: "Invalid username or password" });
    }

    console.log("[loginPublicVendorRegistration] success", {
      vendorName: invite.vendor_name,
      expiresAt: invite.expires_at,
    });

    res.json({
      success: true,
      vendorName: invite.vendor_name,
      expiresAt: invite.expires_at,
    });
  } catch (error) {
    console.error("[loginPublicVendorRegistration] error", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    if (error.code === "LEGACY_INVITE") {
      return res.status(410).json({ message: error.message });
    }
    if (error.code === "ALREADY_SUBMITTED") {
      return res.status(409).json({ message: error.message });
    }
    res.status(400).json({ message: "Registration link is invalid or expired" });
  }
};

const getPublicVendorRegistrationHandler = async (req, res) => {
  try {
    const invite = await vendorService.getRegistrationInvite(req.query.token, req.query.orgId);
    if (!invite) return res.status(410).json({ message: "Registration link is invalid or expired" });
    res.json({ success: true, vendorName: invite.vendor_name, expiresAt: invite.expires_at });
  } catch (error) {
    if (error.code === "ALREADY_SUBMITTED") {
      return res.status(409).json({ message: error.message });
    }
    console.error("Error validating vendor registration link:", error);
    res.status(400).json({ message: "Registration link is invalid" });
  }
};

const completePublicVendorRegistrationHandler = async (req, res) => {
  const { token, orgId, username, password, ...data } = req.body || {};
  try {
    await vendorService.completeRegistration({ token, orgId, username, password, data });
    res.status(201).json({ success: true, message: "Vendor registration submitted" });
  } catch (error) {
    if (error.message === "Registration link is invalid or expired") {
      return res.status(410).json({ message: error.message });
    }
    if (error.code === "ALREADY_SUBMITTED") {
      return res.status(409).json({ message: error.message });
    }
    if (error.code === "INVALID_VENDOR_DATA") {
      return res.status(400).json({ message: error.message });
    }
    console.error("Error completing public vendor registration:", error);
    res.status(500).json({ message: "Failed to submit vendor registration" });
  }
};

const getPendingVendorRegistrationsHandler = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);
  if (!orgId) return res.status(400).json({ message: "org_id header is required" });
  try {
    const requests = await vendorService.getPendingRegistrations(orgId);
    res.json({ success: true, data: requests });
  } catch (error) {
    console.error("Error fetching vendor registration requests:", error);
    res.status(500).json({ message: "Failed to fetch vendor registration requests" });
  }
};

const approveVendorRegistrationHandler = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);
  if (!orgId) return res.status(400).json({ message: "org_id header is required" });
  try {
    await vendorService.approveRegistration(req.params.id, orgId);
    res.json({ success: true, message: "Vendor registration approved" });
  } catch (error) {
    console.error("Error approving vendor registration:", error);
    const status = error.message === "Registration request not found" ? 404 : 500;
    res.status(status).json({ message: error.message || "Failed to approve vendor registration" });
  }
};

const rejectVendorRegistrationHandler = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);
  if (!orgId) return res.status(400).json({ message: "org_id header is required" });
  try {
    await vendorService.rejectRegistration(req.params.id, orgId);
    res.json({ success: true, message: "Vendor registration rejected" });
  } catch (error) {
    const status = error.message === "Registration request not found" ? 404 : 500;
    res.status(status).json({ message: error.message || "Failed to reject vendor registration" });
  }
};

const sendVendorApprovalEmailHandler = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);
  if (!orgId) return res.status(400).json({ message: "org_id header is required" });
  try {
    await vendorService.sendApprovalEmail(req.params.id, orgId);
    res.json({ success: true, message: "Approval email sent" });
  } catch (error) {
    console.error("Error sending vendor approval email:", error);
    res.status(502).json({ message: error.message || "Failed to send approval email" });
  }
};

const getAllVendorsHandler = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);
  if (!orgId) {
    return res.status(400).json({ message: "org_id header is required" });
  }

  try {
    const vendors = await vendorService.getVendorsByOrgId(orgId);
    res.status(200).json({ success: true, data: vendors });
  } catch (error) {
    console.error("❌ Error fetching vendors:", error);
    if (error.message === "Organization not found") {
      return res.status(404).json({ message: "Organization not found" });
    }
    res.status(500).json({ message: "Failed to fetch vendors" });
  }
};

function resolveDiskPathFromStored(dbValue, orgId) {
  if (!dbValue) return null;

  try {
    if (path.isAbsolute(dbValue) && fs.existsSync(dbValue)) {
      return dbValue;
    }
  } catch (e) {}

  const vendorFilesDir = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "vendorfiles",
    orgId
  );
  const base = path.basename(dbValue);
  const candidate = path.join(vendorFilesDir, base);

  if (fs.existsSync(candidate)) return candidate;
  return null;
}

const updateVendorHandler = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);
  if (!orgId) {
    return res.status(400).json({ message: "org_id header is required" });
  }

  try {
    const vendorId = req.params.id;

    const existingVendor = await vendorService.getVendorById(vendorId, orgId);

    if (!existingVendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const files = req.files || {};

    const fileKeys = [
      "gst_certificate",
      "pan_card",
      "cancelled_cheque",
      "msme_certificate",
      "incorporation_certificate",
    ];

    const finalFileValues = {};

    for (const key of fileKeys) {
      const uploaded = files[key]?.[0]?.path || null;
      const removeFlag =
        req.body?.[`remove_${key}`] === "1" ||
        req.body?.[`remove_${key}`] === "true";

      const existingValue = existingVendor[key] || null;

      if (uploaded) {
        finalFileValues[key] = uploaded;
        const oldDisk = resolveDiskPathFromStored(existingValue, orgId);
        if (oldDisk) fs.unlinkSync(oldDisk);
      } else if (removeFlag) {
        finalFileValues[key] = null;
        const oldDisk = resolveDiskPathFromStored(existingValue, orgId);
        if (oldDisk) fs.unlinkSync(oldDisk);
      } else {
        finalFileValues[key] = existingValue;
      }
    }

    const vendorData = [
      req.body.company_name || existingVendor.company_name,
      req.body.registered_address || existingVendor.registered_address,
      req.body.city || existingVendor.city,
      req.body.state || existingVendor.state,
      req.body.pin_code || existingVendor.pin_code,
      req.body.gst_number || existingVendor.gst_number,
      req.body.pan_number || existingVendor.pan_number,
      req.body.company_type || existingVendor.company_type,
      req.body.contact1_name || existingVendor.contact1_name,
      req.body.contact1_designation || existingVendor.contact1_designation,
      req.body.contact1_mobile || existingVendor.contact1_mobile,
      req.body.contact1_email || existingVendor.contact1_email,
      req.body.contact2_name || existingVendor.contact2_name,
      req.body.contact2_designation || existingVendor.contact2_designation,
      req.body.contact2_mobile || existingVendor.contact2_mobile,
      req.body.contact2_email || existingVendor.contact2_email,
      req.body.contact3_name || existingVendor.contact3_name,
      req.body.contact3_designation || existingVendor.contact3_designation,
      req.body.contact3_mobile || existingVendor.contact3_mobile,
      req.body.contact3_email || existingVendor.contact3_email,
      req.body.bank_name || existingVendor.bank_name,
      req.body.branch || existingVendor.branch,
      req.body.branch_address || existingVendor.branch_address,
      req.body.account_number || existingVendor.account_number,
      req.body.ifsc_code || existingVendor.ifsc_code,
      req.body.nature_of_business || existingVendor.nature_of_business,
      req.body.product_category || existingVendor.product_category,
      req.body.years_of_experience || existingVendor.years_of_experience,
      finalFileValues.gst_certificate,
      finalFileValues.pan_card,
      finalFileValues.cancelled_cheque,
      finalFileValues.msme_certificate,
      req.body.msme_status || existingVendor.msme_status,
      finalFileValues.incorporation_certificate,
    ];

    const result = await vendorService.updateVendorById(
      vendorData,
      vendorId,
      orgId
    );

    res.status(200).json({
      success: true,
      message: "Vendor updated successfully",
      result,
    });
  } catch (error) {
    console.error("❌ Error updating vendor:", error);
    if (error.message === "Organization not found") {
      return res.status(404).json({ message: "Organization not found" });
    }
    res.status(500).json({ message: "Failed to update vendor" });
  }
};

module.exports = {
  addVendorHandler,
  getAllVendorsHandler,
  updateVendorHandler,
  sendVendorRegistrationInviteHandler,
  loginPublicVendorRegistrationHandler,
  getPublicVendorRegistrationHandler,
  completePublicVendorRegistrationHandler,
  getPendingVendorRegistrationsHandler,
  approveVendorRegistrationHandler,
  rejectVendorRegistrationHandler,
  sendVendorApprovalEmailHandler,
};
