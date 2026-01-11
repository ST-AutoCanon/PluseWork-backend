// const {
//   getTenantPool,
//   sanitizeDbName,
// } = require("../db/tenantPoolManager");

// const queries = require("../constants/salaryPreferenceQueries");

// /**
//  * Resolve tenant pool exactly like assets service
//  */
// async function getTenantPoolForOrgId(orgId) {
//   if (!orgId) {
//     const err = new Error("orgId required");
//     err.code = "ORG_REQUIRED";
//     throw err;
//   }

//   const dbName = sanitizeDbName(`tenant_${orgId}`);
//   return getTenantPool(dbName);
// }
// async function getSelectedTemplateId(pool, orgId) {
//   const [rows] = await pool.query(
//     "SELECT selected_template_id FROM salary_preferences WHERE org_id = ? LIMIT 1",
//     [orgId]
//   );
//   return rows.length ? rows[0].selected_template_id : null;
// }



// /* ================= GET ================= */
// const getPreferences = async (orgId) => {
//   const tenantPool = await getTenantPoolForOrgId(orgId);

//   const [rows] = await tenantPool.query(
//     queries.GET_SALARY_PREFERENCES,
//     [orgId]
//   );

//   return rows.length ? rows[0] : null;
// };

// /* ================= SAVE ================= */
// const savePreferences = async (orgId, data) => {
//   const tenantPool = await getTenantPoolForOrgId(orgId);

//   const {
//     selected_month,
//     selected_year,
//     selected_template_id,
//   } = data;

//   await tenantPool.query(
//     queries.UPSERT_SALARY_PREFERENCES,
//     [
//       orgId,
//       selected_month,
//       selected_year,
//       selected_template_id || null,
//     ]
//   );

//   return true;
// };

// module.exports = {
//   getPreferences,
//   savePreferences,getSelectedTemplateId,
// };
const {
  getTenantPool,
  sanitizeDbName,
} = require("../db/tenantPoolManager");
console.log("✅ salaryPreferenceService LOADED", __filename);

const queries = require("../constants/salaryPreferenceQueries");

/**
 * Resolve tenant pool
 */
async function getTenantPoolForOrgId(orgId) {
  if (!orgId) {
    const err = new Error("orgId required");
    err.code = "ORG_REQUIRED";
    throw err;
  }

  const dbName = sanitizeDbName(`tenant_${orgId}`);
  return getTenantPool(dbName);
}

/**
 * Get selected template id
 */
async function getSelectedTemplateId(pool, orgId) {
  const [rows] = await pool.query(
    "SELECT selected_template_id FROM salary_preferences WHERE org_id = ? LIMIT 1",
    [orgId]
  );

  return rows.length ? rows[0].selected_template_id : null;
}

/**
 * Get salary preferences
 */
const getPreferences = async (orgId) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const [rows] = await tenantPool.query(
    queries.GET_SALARY_PREFERENCES,
    [orgId]
  );

  return rows.length ? rows[0] : null;
};

/**
 * Save salary preferences
 */
const savePreferences = async (orgId, data) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const {
    selected_month,
    selected_year,
    selected_template_id,
  } = data;

  await tenantPool.query(
    queries.UPSERT_SALARY_PREFERENCES,
    [
      orgId,
      selected_month,
      selected_year,
      selected_template_id || null,
    ]
  );

  return true;
};

module.exports = {
  getPreferences,
  savePreferences,
  getSelectedTemplateId,
};
