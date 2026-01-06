// handlers/letterheadTemplateHandler.js
const templateService = require("../services/letterheadTemplateService");
const ErrorHandler = require("../utils/errorHandler"); // optional, if you use it elsewhere

// Resolve orgId helper (same pattern as your leave handler)
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

const addTemplateHandler = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    if (!orgId) {
      return res
        .status(400)
        .json({ error: "Missing orgId in headers/query/body" });
    }

    const { letter_type, content, subject, company_name, company_address } =
      req.body || {};

    if (
      !letter_type ||
      !content ||
      !subject ||
      !company_name ||
      !company_address
    ) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const tenantPool =
      await require("../db/tenantPoolManager").getTenantPoolByOrgId(orgId);

    // ensure table exists for tenant (idempotent)
    await templateService.createLetterheadTemplatesTable(tenantPool);

    // check if template exists for this tenant
    const existing = await templateService.getTemplateByLetterType(
      tenantPool,
      orgId,
      letter_type
    );

    let result;
    if (existing) {
      result = await templateService.updateTemplateByLetterType(
        tenantPool,
        orgId,
        { content, subject, company_name, company_address },
        letter_type
      );
      return res
        .status(200)
        .json({ message: "Template updated successfully", result });
    } else {
      result = await templateService.insertTemplate(tenantPool, orgId, {
        letter_type,
        content,
        subject,
        company_name,
        company_address,
      });
      return res
        .status(201)
        .json({ message: "Template added successfully", result });
    }
  } catch (error) {
    console.error("Error in addTemplateHandler:", error);
    return res
      .status(500)
      .json({ error: "Failed to add/update template", details: error.message });
  }
};

const getAllTemplatesHandler = async (req, res) => {
  try {
    const orgId =
      req.headers["x-org-id"] ||
      req.query?.orgId ||
      (req.user && (req.user.orgId || req.user.org_id)) ||
      null;

    if (!orgId) {
      return res.status(400).json({ error: "Missing orgId in headers/query" });
    }

    const tenantPool =
      await require("../db/tenantPoolManager").getTenantPoolByOrgId(orgId);

    await templateService.createLetterheadTemplatesTable(tenantPool);
    // optionally insert defaults if tenant has none:
    await templateService.insertDefaultTemplatesIfMissing(tenantPool, orgId);

    const templates = await templateService.getAllTemplates(tenantPool, orgId);
    return res.status(200).json({ success: true, data: templates });
  } catch (error) {
    console.error("Error in getAllTemplatesHandler:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching templates",
      details: error.message,
    });
  }
};

module.exports = {
  addTemplateHandler,
  getAllTemplatesHandler,
};
