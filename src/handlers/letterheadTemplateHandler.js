const templateService = require("../services/letterheadTemplateService");

const addTemplateHandler = async (req, res) => {
  try {
    const { letter_type, content, subject, company_name, company_address } =
      req.body;

    if (
      !letter_type ||
      !content ||
      !subject ||
      !company_name ||
      !company_address
    ) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const templateData = [
      letter_type,
      content,
      subject,
      company_name,
      company_address,
    ];

    const existingTemplates = await templateService.getAllTemplates();
    const templateExists = existingTemplates.some(
      (t) => t.letter_type === letter_type
    );

    let result;
    if (templateExists) {
      result = await templateService.updateTemplateByLetterType(
        templateData,
        letter_type
      );
      res
        .status(200)
        .json({ message: "Template updated successfully", result });
    } else {
      result = await templateService.insertTemplate(templateData);
      res.status(201).json({ message: "Template added successfully", result });
    }
  } catch (error) {
    console.error("Error in addTemplateHandler:", error);
    res
      .status(500)
      .json({ error: "Failed to add/update template", details: error.message });
  }
};

const getAllTemplatesHandler = async (req, res) => {
  try {
    const templates = await templateService.getAllTemplates();
    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    console.error("Error in getAllTemplatesHandler:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching templates" });
  }
};

module.exports = {
  addTemplateHandler,
  getAllTemplatesHandler,
};
