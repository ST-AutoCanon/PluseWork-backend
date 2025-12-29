const dbMaster = require("../config"); // keep master for any master-scoped work if needed
const { ADD_DEPARTMENT, GET_DEPARTMENTS } = require("../constants/queries");
const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");

/**
 * Resolve a tenant pool for provided orgId. Throws if orgId missing.
 */
async function getTenantPoolForOrgId(orgId) {
  if (!orgId) {
    const err = new Error("orgId required to get tenant pool");
    err.code = "ORG_REQUIRED";
    throw err;
  }
  const dbName = sanitizeDbName(`tenant_${orgId}`);
  return getTenantPool(dbName);
}

/**
 * Add department in tenant DB.
 * name: string, icon: web-path string or null, orgId: string
 */
const addDepartmentService = async (name, icon, orgId) => {
  if (!orgId) {
    throw new Error("orgId required");
  }

  const tenantPool = await getTenantPoolForOrgId(orgId);

  try {
    // Use tenant pool — tenant DB may or may not expect org_id column.
    // We pass orgId as before (harmless if tenant table has an org_id column).
    const [results] = await tenantPool.query(ADD_DEPARTMENT, [
      name,
      icon,
      orgId,
    ]);
    return results;
  } catch (error) {
    // translate duplicate key to nicer message (same behaviour as before)
    if (error && error.code === "ER_DUP_ENTRY") {
      throw new Error("Department already exists");
    }
    throw error;
  }
};

/**
 * Get departments from tenant DB.
 */
const getDepartmentsService = async (orgId) => {
  if (!orgId) {
    throw new Error("orgId required");
  }

  const tenantPool = await getTenantPoolForOrgId(orgId);

  try {
    // If your tenant schema stores departments without org_id, you can remove the param.
    const [results] = await tenantPool.query(GET_DEPARTMENTS, [orgId]);
    return results;
  } catch (error) {
    throw error;
  }
};

module.exports = { addDepartmentService, getDepartmentsService };
