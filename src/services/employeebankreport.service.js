const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");

const getEmployeePersonalDetails = async (orgId, employeeIds) => {
  console.log("ORG:", orgId);
  console.log("IDS:", employeeIds);

  if (!orgId) throw new Error("orgId missing");

  if (!Array.isArray(employeeIds)) {
    throw new Error("employeeIds is not an array");
  }

  const validIds = employeeIds.filter(
    (id) => typeof id === "string" && id.trim()
  );

  if (validIds.length === 0) return [];

  const tenantPool = await getTenantPoolByOrgId(orgId);

  if (!tenantPool || typeof tenantPool.query !== "function") {
    throw new Error("Invalid tenant pool");
  }

  await tenantPool.query("SELECT 1");

  const placeholders = validIds.map(() => "?").join(",");
  const sql = `
    SELECT employee_id, pan_number, uan_number
    FROM employee_personal
    WHERE employee_id IN (${placeholders})
  `;

  const result = await tenantPool.query(sql, validIds);
  const rows = Array.isArray(result[0]) ? result[0] : result;

  return rows;
};

module.exports = {
  getEmployeePersonalDetails,
};
