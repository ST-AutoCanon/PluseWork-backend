const vendorService = require("../services/vendorService");
const path = require("path");
const fs = require("fs");

const addVendorHandler = async (req, res) => {
  try {
    const orgId =
      req.headers["x-org-id"] ||
      req.headers["x-organization-id"] ||
      (req.body && req.body.orgId) ||
      null;

    if (!orgId) {
      return res
        .status(400)
        .json({ error: "orgId (x-org-id) header is required" });
    }

    const {
      name,
      contact_person,
      email,
      phone,
      address,
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

    const files = req.files || {};
    const gst_certificate = files.gst_certificate
      ? files.gst_certificate[0].path
      : null;
    const pan_card = files.pan_card ? files.pan_card[0].path : null;
    const cancelled_cheque = files.cancelled_cheque
      ? files.cancelled_cheque[0].path
      : null;
    const msme_certificate = files.msme_certificate
      ? files.msme_certificate[0].path
      : null;
    const incorporation_certificate = files.incorporation_certificate
      ? files.incorporation_certificate[0].path
      : null;

    if (!company_name) {
      return res.status(400).json({ error: "Company name is required" });
    }

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
      gst_certificate || null,
      pan_card || null,
      cancelled_cheque || null,
      msme_certificate || null,
      msme_status || null,
      incorporation_certificate || null,
    ];

    const result = await vendorService.insertVendor(vendorData, orgId);
    res.status(201).json({
      success: true,
      message: "Vendor added successfully",
      result,
    });
  } catch (error) {
    console.error("Error in addVendorHandler:", error);
    res
      .status(500)
      .json({ error: "Failed to add vendor", details: error.message });
  }
};

const getAllVendorsHandler = async (req, res) => {
  try {
    const orgId =
      req.headers["x-org-id"] ||
      req.headers["x-organization-id"] ||
      (req.query && req.query.orgId) ||
      null;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "orgId (x-org-id) header is required",
      });
    }

    const vendors = await vendorService.getVendorsByOrgId(orgId);
    res.status(200).json({ success: true, data: vendors });
  } catch (error) {
    console.error("Error in getAllVendorsHandler:", error);
    res.status(500).json({ success: false, message: "Error fetching vendors" });
  }
};

function resolveDiskPathFromStored(dbValue, orgId) {
  if (!dbValue) return null;
  try {
    if (path.isAbsolute(dbValue) && fs.existsSync(dbValue)) {
      return dbValue;
    }
  } catch (e) {}

  const vendorFilesDir = path.join(__dirname, "..", "..", "..", "vendorfiles");
  const base = path.basename(dbValue);
  const candidate = path.join(vendorFilesDir, orgId, base);
  if (fs.existsSync(candidate)) return candidate;

  return null;
}

const updateVendorHandler = async (req, res) => {
  try {
    const vendorId = req.params.id;
    const orgId =
      req.headers["x-org-id"] ||
      req.headers["x-organization-id"] ||
      (req.body && req.body.orgId) ||
      null;

    if (!orgId) {
      return res
        .status(400)
        .json({ error: "orgId (x-org-id) header is required" });
    }

    const existingVendor = await vendorService.getVendorById(vendorId, orgId);
    if (!existingVendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

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
      const uploaded = files[key] && files[key][0] ? files[key][0].path : null;
      const removeFlag =
        req.body &&
        (req.body[`remove_${key}`] === "1" ||
          req.body[`remove_${key}`] === "true");
      const existingValue = existingVendor[key] || null;

      if (uploaded) {
        finalFileValues[key] = uploaded;

        const oldDisk = resolveDiskPathFromStored(existingValue, orgId);
        if (oldDisk) {
          try {
            fs.unlinkSync(oldDisk);
          } catch (e) {
            console.warn(
              `Failed to delete replaced file ${oldDisk}:`,
              e.message
            );
          }
        }
      } else if (removeFlag) {
        finalFileValues[key] = null;
        const oldDisk = resolveDiskPathFromStored(existingValue, orgId);
        if (oldDisk) {
          try {
            fs.unlinkSync(oldDisk);
          } catch (e) {
            console.warn(
              `Failed to delete removed file ${oldDisk}:`,
              e.message
            );
          }
        }
      } else {
        finalFileValues[key] = existingValue;
      }
    }

    const vendorData = [
      company_name || existingVendor.company_name || null,
      registered_address || existingVendor.registered_address || null,
      city || existingVendor.city || null,
      state || existingVendor.state || null,
      pin_code || existingVendor.pin_code || null,
      gst_number || existingVendor.gst_number || null,
      pan_number || existingVendor.pan_number || null,
      company_type || existingVendor.company_type || null,
      contact1_name || existingVendor.contact1_name || null,
      contact1_designation || existingVendor.contact1_designation || null,
      contact1_mobile || existingVendor.contact1_mobile || null,
      contact1_email || existingVendor.contact1_email || null,
      contact2_name || existingVendor.contact2_name || null,
      contact2_designation || existingVendor.contact2_designation || null,
      contact2_mobile || existingVendor.contact2_mobile || null,
      contact2_email || existingVendor.contact2_email || null,
      contact3_name || existingVendor.contact3_name || null,
      contact3_designation || existingVendor.contact3_designation || null,
      contact3_mobile || existingVendor.contact3_mobile || null,
      contact3_email || existingVendor.contact3_email || null,
      bank_name || existingVendor.bank_name || null,
      branch || existingVendor.branch || null,
      branch_address || existingVendor.branch_address || null,
      account_number || existingVendor.account_number || null,
      ifsc_code || existingVendor.ifsc_code || null,
      nature_of_business || existingVendor.nature_of_business || null,
      product_category || existingVendor.product_category || null,
      years_of_experience || existingVendor.years_of_experience || null,
      finalFileValues["gst_certificate"] || null,
      finalFileValues["pan_card"] || null,
      finalFileValues["cancelled_cheque"] || null,
      finalFileValues["msme_certificate"] || null,
      msme_status || existingVendor.msme_status || null,
      finalFileValues["incorporation_certificate"] || null,
    ];

    const result = await vendorService.updateVendorById(
      vendorData,
      vendorId,
      orgId
    );
    if (result && result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Vendor not found for this org or no changes made" });
    }
    res.status(200).json({
      success: true,
      message: "Vendor updated successfully",
      result,
    });
  } catch (error) {
    console.error("Error in updateVendorHandler:", error);
    res
      .status(500)
      .json({ error: "Failed to update vendor", details: error.message });
  }
};

module.exports = {
  addVendorHandler,
  getAllVendorsHandler,
  updateVendorHandler,
};
