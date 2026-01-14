const templateService = require("../services/letterheadTemplateService");

const getOrgIdFromHeaders = (req) => {
  return (
    req.headers.org_id ||
    req.headers["org-id"] ||
    req.headers["x-org-id"] ||
    null
  );
};

const addTemplateHandler = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);

  if (!orgId) {
    return res.status(400).json({ error: "org_id is required in headers" });
  }

  try {
    const {
      letter_type,
      content,
      subject,
      company_name,
      company_address,
      company_address_line2,
      gstin_number,
      cin_number,
    } = req.body;

    if (!letter_type || !content) {
      return res
        .status(400)
        .json({ error: "letter_type and content are required" });
    }

    const templateData = {
      letter_type,
      content,
      subject: subject || null,
      company_name: company_name || null,
      company_address: company_address || null,
      company_address_line2: company_address_line2 || null,
      gstin_number: gstin_number || null,
      cin_number: cin_number || null,
    };

    const existingTemplates = await templateService.getAllTemplates(orgId);
    const templateExists = existingTemplates.some(
      (t) => t.letter_type === letter_type
    );

    let result;
    if (templateExists) {
      result = await templateService.updateTemplateByLetterType(
        orgId,
        templateData
      );
      return res.status(200).json({
        success: true,
        message: "Template updated successfully",
        data: result,
      });
    } else {
      result = await templateService.insertTemplate(orgId, templateData);
      return res.status(201).json({
        success: true,
        message: "Template added successfully",
        data: result,
      });
    }
  } catch (error) {
    console.error("Error in addTemplateHandler:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add/update template",
      details: error.message,
    });
  }
};

const getAllTemplatesHandler = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);

  if (!orgId) {
    return res.status(400).json({ error: "org_id is required in headers" });
  }

  try {
    const templates = await templateService.getAllTemplates(orgId);
    res.status(200).json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error("Error in getAllTemplatesHandler:", error);
    res.status(500).json({
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
