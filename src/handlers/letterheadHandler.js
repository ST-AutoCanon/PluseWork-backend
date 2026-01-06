const path = require("path");
const fs = require("fs");
const letterheadService = require("../services/letterheadService");
const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");

const resolveOrgId = (req) =>
  req.headers["x-org-id"] ||
  req.headers["x_org_id"] ||
  req.headers["org_id"] ||
  req.headers["org-id"] ||
  req.query?.orgId ||
  req.query?.org_id ||
  req.body?.orgId ||
  req.body?.org_id ||
  (req.user && (req.user.orgId || req.user.org_id)) ||
  null;

const LETTERHEAD_BASE_DIR = path.join(__dirname, "..", "letterheadfiles");
async function ensureOrgDir(orgId) {
  const dir = path.join(LETTERHEAD_BASE_DIR, `org_${String(orgId)}`);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const addLetterheadHandler = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    if (!orgId) {
      return res
        .status(400)
        .json({ error: "Missing orgId in headers/query/body" });
    }

    await ensureOrgDir(orgId);

    const {
      template_name,
      letter_type,
      subject,
      body,
      recipient_name,
      title,
      mobile_number,
      email,
      address,
      date,
      signature,
      employee_name,
      position,
      annual_salary,
      effective_date,
      date_of_appointment,
      place,
    } = req.body || {};

    if (!letter_type || !body) {
      return res
        .status(400)
        .json({ error: "Required fields (letter_type, body) are missing" });
    }

    const files = req.files || {};
    let attachment = null;
    if (files.letterhead_file && files.letterhead_file[0]) {
      attachment = files.letterhead_file[0].filename;
    }

    const letterheadData = {
      template_name,
      letter_type,
      subject,
      body,
      recipient_name,
      title,
      mobile_number,
      email,
      address,
      date,
      signature,
      employee_name,
      position,
      annual_salary,
      effective_date,
      date_of_appointment,
      attachment,
      place,
    };

    const tenantPool = await getTenantPoolByOrgId(orgId);
    const result = await letterheadService.insertLetterhead(
      tenantPool,
      orgId,
      letterheadData
    );

    return res
      .status(201)
      .json({ message: "Letterhead added successfully", id: result.insertId });
  } catch (error) {
    console.error("Error in addLetterheadHandler:", error);
    return res
      .status(500)
      .json({ error: "Failed to add letterhead", details: error.message });
  }
};

const getAllLetterheadsHandler = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    if (!orgId) {
      return res.status(400).json({ error: "Missing orgId in headers/query" });
    }
    const tenantPool = await getTenantPoolByOrgId(orgId);
    const letterheads = await letterheadService.getAllLetterheads(
      tenantPool,
      orgId
    );
    return res.status(200).json({ success: true, data: letterheads });
  } catch (error) {
    console.error("Error in getAllLetterheadsHandler:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch letterheads", details: error.message });
  }
};

const updateLetterheadHandler = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    if (!orgId) {
      return res
        .status(400)
        .json({ error: "Missing orgId in headers/query/body" });
    }

    const id = req.params.id;

    const {
      letterhead_code,
      template_name,
      letter_type,
      subject,
      body,
      recipient_name,
      title,
      mobile_number,
      email,
      address,
      date,
      signature,
      employee_name,
      position,
      annual_salary,
      effective_date,
      date_of_appointment,
      place,
    } = req.body || {};

    if (!letter_type || !body) {
      return res
        .status(400)
        .json({ error: "Required fields (letter_type, body) are missing" });
    }

    const files = req.files || {};
    let attachment = null;

    const tenantPool = await getTenantPoolByOrgId(orgId);
    const existingLetterhead = await letterheadService.getLetterheadById(
      tenantPool,
      orgId,
      id
    );
    if (!existingLetterhead) {
      return res.status(404).json({ error: "Letterhead not found" });
    }

    if (files.letterhead_file && files.letterhead_file[0]) {
      attachment = files.letterhead_file[0].filename;
      if (existingLetterhead.attachment) {
        const oldFilePath = path.join(
          LETTERHEAD_BASE_DIR,
          `org_${String(orgId)}`,
          existingLetterhead.attachment
        );
        try {
          if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
        } catch (e) {
          console.warn(
            "[updateLetterheadHandler] failed to delete old file:",
            e
          );
        }
      }
    } else {
      attachment = existingLetterhead.attachment;
    }

    const letterheadData = {
      letterhead_code,
      template_name,
      letter_type,
      subject,
      body,
      recipient_name,
      title,
      mobile_number,
      email,
      address,
      date,
      signature,
      employee_name,
      position,
      annual_salary,
      effective_date,
      date_of_appointment,
      attachment,
      place,
    };

    const result = await letterheadService.updateLetterheadById(
      tenantPool,
      orgId,
      letterheadData,
      id
    );
    return res
      .status(200)
      .json({ message: "Letterhead updated successfully", result });
  } catch (error) {
    console.error("Error in updateLetterheadHandler:", error);
    return res
      .status(500)
      .json({ error: "Failed to update letterhead", details: error.message });
  }
};

const getLetterheadByIdHandler = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    if (!orgId) {
      return res.status(400).json({ error: "Missing orgId in headers/query" });
    }
    const id = req.params.id;
    const tenantPool = await getTenantPoolByOrgId(orgId);
    const letterhead = await letterheadService.getLetterheadById(
      tenantPool,
      orgId,
      id
    );
    if (!letterhead) {
      return res.status(404).json({ error: "Letterhead not found" });
    }
    return res.status(200).json({ success: true, data: letterhead });
  } catch (error) {
    console.error("Error in getLetterheadByIdHandler:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch letterhead", details: error.message });
  }
};

module.exports = {
  addLetterheadHandler,
  getAllLetterheadsHandler,
  updateLetterheadHandler,
  getLetterheadByIdHandler,
};
