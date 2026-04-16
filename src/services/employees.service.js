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
const getFormResponsesWithNames = async (orgId, formId) => {
  console.log(`📋 [SERVICE] Fetching form responses for formId: ${formId}`);

  try {
    const tenantPool = await getTenantPoolByOrgId(orgId);

    const [rows] = await tenantPool.query(`
   SELECT 
  r.*,

  -- ✅ Employee Name
  e.first_name AS employee_first_name,
  e.middle_name AS employee_middle_name,
  e.last_name AS employee_last_name,

  -- ✅ Get supervisor_id from professional table
  ep.supervisor_id,

  -- ✅ Supervisor Name
  s.first_name AS supervisor_first_name,
  s.middle_name AS supervisor_middle_name,
  s.last_name AS supervisor_last_name

FROM form_responses r

JOIN employees e 
  ON r.employee_id = e.employee_id

LEFT JOIN employee_professional ep 
  ON e.employee_id = ep.employee_id

LEFT JOIN employees s 
  ON ep.supervisor_id = s.employee_id

WHERE r.form_id = ?
ORDER BY r.submitted_at DESC;
    `, [formId]);

    console.log(`✅ [SERVICE] Fetched ${rows.length} responses`);
    return rows;

  } catch (err) {
    console.error("❌ [SERVICE] getFormResponsesWithNames error:", err.message);
    throw err;
  }
};
module.exports = { getEmployees 
  ,  getFormResponsesWithNames   // ✅ add this

};
