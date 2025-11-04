const db = require("../config");
const queries = require("../constants/letterheadTemplateQueries");

const createLetterheadTemplatesTable = async () => {
  try {
    await db.query(queries.CREATE_LETTERHEAD_TEMPLATES_TABLE);
  } catch (error) {
    console.error("Error creating letterhead templates table:", error);
    throw new Error("Error creating letterhead templates table");
  }
};

const insertDefaultTemplates = async () => {
  try {
    await db.query(queries.INSERT_DEFAULT_TEMPLATES);
  } catch (error) {
    console.error("Error inserting default templates:", error);
    throw new Error("Error inserting default templates");
  }
};

const getAllTemplates = async () => {
  try {
    const [rows] = await db.query(queries.GET_ALL_TEMPLATES);
    return rows;
  } catch (error) {
    console.error("Error fetching templates:", error);
    throw new Error("Error fetching templates");
  }
};

const insertTemplate = async (templateData) => {
  try {
    const [result] = await db.query(queries.INSERT_TEMPLATE, templateData);
    return result;
  } catch (error) {
    console.error("Error inserting template:", error);
    throw new Error("Error inserting template");
  }
};

const updateTemplateByLetterType = async (templateData, letterType) => {
  try {
    const [result] = await db.query(queries.UPDATE_TEMPLATE_BY_LETTER_TYPE, [
      ...templateData,
      letterType,
    ]);
    return result;
  } catch (error) {
    console.error("Error updating template:", error);
    throw new Error("Error updating template");
  }
};

module.exports = {
  createLetterheadTemplatesTable,
  insertDefaultTemplates,
  getAllTemplates,
  insertTemplate,
  updateTemplateByLetterType,
};
