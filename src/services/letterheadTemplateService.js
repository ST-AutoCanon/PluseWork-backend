const queries = require("../constants/letterheadTemplateQueries");
const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");

async function getTenantPoolForOrgId(orgId) {
  if (!orgId) {
    const err = new Error("orgId required to get tenant pool");
    err.code = "ORG_REQUIRED";
    throw err;
  }
  const dbName = sanitizeDbName(`tenant_${orgId}`);
  return getTenantPool(dbName);
}

const createLetterheadTemplatesTable = async (orgId) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  try {
    await tenantPool.query(queries.CREATE_LETTERHEAD_TEMPLATES_TABLE);
  } catch (error) {
    console.error("Error creating letterhead templates table:", error);
    throw new Error("Error creating letterhead templates table");
  }
};

const insertDefaultTemplates = async (orgId) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  try {
    await tenantPool.query(queries.INSERT_DEFAULT_TEMPLATES, [
      orgId,
      orgId,
      orgId,
      orgId,
    ]);
  } catch (error) {
    console.error("Error inserting default templates:", error);
    throw new Error("Error inserting default templates");
  }
};

const getAllTemplates = async (orgId) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  try {
    const [rows] = await tenantPool.query(queries.GET_ALL_TEMPLATES, [orgId]);
    return rows;
  } catch (error) {
    console.error("Error fetching templates:", error);
    throw new Error("Error fetching templates: " + error.message);
  }
};

const insertTemplate = async (orgId, templateData) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  try {
    const values = [
      orgId,
      templateData.letter_type,
      templateData.content,
      templateData.subject,
      templateData.company_name,
      templateData.company_address,
      templateData.company_address_line2,
      templateData.gstin_number,
      templateData.cin_number,
    ];
    const [result] = await tenantPool.query(queries.INSERT_TEMPLATE, values);
    return result;
  } catch (error) {
    console.error("Error inserting template:", error);
    throw new Error("Error inserting template: " + error.message);
  }
};

const updateTemplateByLetterType = async (orgId, templateData) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  try {
    const values = [
      templateData.content,
      templateData.subject,
      templateData.company_name,
      templateData.company_address,
      templateData.company_address_line2,
      templateData.gstin_number,
      templateData.cin_number,
      orgId,
      templateData.letter_type,
    ];
    const [result] = await tenantPool.query(
      queries.UPDATE_TEMPLATE_BY_LETTER_TYPE,
      values
    );
    return result;
  } catch (error) {
    console.error("Error updating template:", error);
    throw new Error("Error updating template: " + error.message);
  }
};

module.exports = {
  createLetterheadTemplatesTable,
  insertDefaultTemplates,
  getAllTemplates,
  insertTemplate,
  updateTemplateByLetterType,
};
