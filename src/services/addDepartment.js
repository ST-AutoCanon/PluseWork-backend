const dbMaster = require("../config");
const { ADD_DEPARTMENT, GET_DEPARTMENTS } = require("../constants/queries");
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

const addDepartmentService = async (name, icon, orgId) => {
  if (!orgId) {
    throw new Error("orgId required");
  }

  const tenantPool = await getTenantPoolForOrgId(orgId);

  try {
    const [results] = await tenantPool.query(ADD_DEPARTMENT, [
      name,
      icon,
      orgId,
    ]);
    return results;
  } catch (error) {
    if (error && error.code === "ER_DUP_ENTRY") {
      throw new Error("Department already exists");
    }
    throw error;
  }
};

const getDepartmentsService = async (orgId) => {
  if (!orgId) {
    throw new Error("orgId required");
  }

  const tenantPool = await getTenantPoolForOrgId(orgId);

  try {
    const [results] = await tenantPool.query(GET_DEPARTMENTS, [orgId]);
    return results;
  } catch (error) {
    throw error;
  }
};

module.exports = { addDepartmentService, getDepartmentsService };
