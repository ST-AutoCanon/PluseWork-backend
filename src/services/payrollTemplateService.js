// src/services/payrollTemplateService.js

const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const {
   GET_SALARY_PREFERENCES,
  GET_TEMPLATE_BY_ID,
} = require("../constants/payrollTemplateQuerries");

const getSelectedTemplateId = async (orgId) => {
  console.log("🔍 [SERVICE] Fetching salary preferences for orgId:", orgId);

  const tenantPool = await getTenantPoolByOrgId(orgId);
  console.log("✅ [SERVICE] Tenant pool acquired");

  // CRITICAL FIX: mysql2/promise returns [rows, fields]
  const [rows, fields] = await tenantPool.query(GET_SALARY_PREFERENCES, [orgId]);

  console.log("📊 [SERVICE] Raw rows from DB:", rows);
  console.log("📊 [SERVICE] Number of rows:", rows.length);

  if (rows.length === 0) {
    console.log("⚠️ [SERVICE] No row found in salary_preferences for orgId:", orgId);
    return null;
  }

  return rows[0].selected_template_id;
};

const getTemplateById = async (orgId, templateId) => {
  if (!templateId) return null;

  console.log("🔍 [SERVICE] Fetching template ID:", templateId, "for orgId:", orgId);

  const tenantPool = await getTenantPoolByOrgId(orgId);

  const [rows, fields] = await tenantPool.query(GET_TEMPLATE_BY_ID, [templateId, orgId]);

  console.log("📊 [SERVICE] Template query returned", rows.length, "rows");

  return rows.length > 0 ? rows[0] : null;
};

module.exports = {
  getSelectedTemplateId,
  getTemplateById,
};