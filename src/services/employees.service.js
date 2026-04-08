// src/services/employees.service.js
const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");

const getEmployees = async (orgId) => {
  console.log("=== NEW EMPLOYEE SERVICE LOADED - USING employee_id ===");
  console.log(`📋 [SERVICE] Fetching employees for orgId: ${orgId}`);

  try {
    const tenantPool = await getTenantPoolByOrgId(orgId);

    const [rows] = await tenantPool.query(`
      SELECT 
        employee_id AS id,           -- alias as 'id' for frontend compatibility
        first_name, 
        middle_name, 
        last_name, 
        email,
        phone_number,
        status
      FROM employees 
      WHERE org_id = ? 
        AND status = 'Active'
      ORDER BY first_name, last_name
    `, [orgId]);

    console.log(`✅ [SERVICE] Successfully fetched ${rows.length} employees`);
    return rows;

  } catch (err) {
    console.error("❌ [SERVICE] Database error:", err.sqlMessage || err.message);
    throw err;
  }
};

module.exports = { getEmployees };