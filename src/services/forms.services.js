
const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const QUERIES = require("../constants/forms.constants");

/* ------------------------------------------------ */
/* CREATE FORM */
/* ------------------------------------------------ */
/* ------------------------------------------------ */
/* CREATE FORM */
/* ------------------------------------------------ */
const createForm = async (orgId, formName, formJson, layout, formType = "employee_only", activeFrom = null, activeTo = null) => {
  console.log("📝 [SERVICE] Creating form for orgId:", orgId, "with date range:", activeFrom, "to", activeTo);

  const tenantPool = await getTenantPoolByOrgId(orgId);

  try {
    const [result] = await tenantPool.query(QUERIES.CREATE_FORM, [
      formName,
      JSON.stringify(formJson),
      layout,
      formType,
      activeFrom ? new Date(activeFrom) : null,
      activeTo ? new Date(activeTo) : null,
    ]);

    console.log("✅ [SERVICE] Form created with ID:", result.insertId);
    return result.insertId;
  } catch (err) {
    console.error("Create form error:", err);
    if (err && err.code === "ER_BAD_FIELD_ERROR") {
      console.warn("Falling back to legacy create (no date range columns)");
      const [result] = await tenantPool.query(QUERIES.CREATE_FORM_LEGACY, [
        formName,
        JSON.stringify(formJson),
        layout,
      ]);
      return result.insertId;
    }
    throw err;
  }
};

/* ------------------------------------------------ */
/* UPDATE FORM */
/* ------------------------------------------------ */
const updateForm = async (orgId, id, formName, formJson, layout, formType = "employee_only", activeFrom = null, activeTo = null) => {
  console.log("✏️ [SERVICE] Updating form:", id, "for orgId:", orgId);

  const tenantPool = await getTenantPoolByOrgId(orgId);

  try {
    await tenantPool.query(QUERIES.UPDATE_FORM, [
      formName,
      JSON.stringify(formJson),
      layout,
      formType,
      activeFrom ? new Date(activeFrom) : null,
      activeTo ? new Date(activeTo) : null,
      id,
    ]);
    console.log("✅ [SERVICE] Form updated successfully");
  } catch (err) {
    console.error("Update form error:", err);
    if (err && err.code === "ER_BAD_FIELD_ERROR") {
      console.warn("Falling back to legacy update");
      await tenantPool.query(QUERIES.UPDATE_FORM_LEGACY, [
        formName,
        JSON.stringify(formJson),
        layout,
        id,
      ]);
    } else {
      throw err;
    }
  }
};

/* ------------------------------------------------ */
/* GET ALL FORMS */
/* ------------------------------------------------ */
const getForms = async (orgId) => {
  console.log("📄 [SERVICE] Fetching forms for orgId:", orgId);

  const tenantPool = await getTenantPoolByOrgId(orgId);

  const [rows] = await tenantPool.query(QUERIES.GET_FORMS, []);

  console.log("📊 [SERVICE] Forms found:", rows.length);

  return rows;
};

/* ------------------------------------------------ */
/* GET SINGLE FORM */
/* ------------------------------------------------ */
const getFormById = async (orgId, id) => {
  console.log("🔍 [SERVICE] Fetching form:", id, "for orgId:", orgId);

  const tenantPool = await getTenantPoolByOrgId(orgId);

  const [rows] = await tenantPool.query(QUERIES.GET_FORM_BY_ID, [id]);

  if (rows.length === 0) {
    console.log("⚠️ [SERVICE] Form not found");
    return null;
  }

  console.log("✅ [SERVICE] Form retrieved");
  return rows[0];
};

/* ------------------------------------------------ */
/* SUBMIT FORM RESPONSE */
/* ------------------------------------------------ */
const submitResponse = async (
  orgId,
  formId,
  employeeId,
  responseJson,
  options = {}
) => {
  console.log("📥 [SERVICE] Submitting response for form:", formId, "orgId:", orgId, "employeeId:", employeeId);

  const tenantPool = await getTenantPoolByOrgId(orgId);

  const form = await getFormById(orgId, formId);
  if (!form) {
    throw new Error("Form not found");
  }

  if (form.active_until && new Date(form.active_until) < new Date()) {
    throw new Error("This form is no longer active for submissions");
  }

  const targetEmployeeId = options.isReview
    ? options.reviewedEmployeeId || employeeId
    : employeeId;

  if (!targetEmployeeId) {
    throw new Error("Target employee ID is required for form response");
  }

  const [existingRows] = await tenantPool.query(
    QUERIES.GET_RESPONSE_BY_FORM_EMPLOYEE,
    [formId, targetEmployeeId, orgId]
  );

  const existing = existingRows[0];

  if (!options.isReview && existing) {
    throw new Error("You have already submitted this form once");
  }

  const safeParse = (json) => {
    if (!json) return {};
    try {
      return typeof json === "object" ? json : JSON.parse(json);
    } catch (_err) {
      return {};
    }
  };

  const existingData = existing ? safeParse(existing.response_json) : {};
  const mergedResponse = {
    ...existingData,
    ...responseJson,
    __form_id: formId,
    __org_id: orgId,
    __employee_id: targetEmployeeId,
  };

  if (options.isReview) {
    mergedResponse.__reviewed_by = employeeId;
    mergedResponse.__reviewed_employee = targetEmployeeId;
    mergedResponse.__reviewed_at = new Date().toISOString();
    mergedResponse.__is_review = true;
  } else {
    mergedResponse.__submitted_by = employeeId;
    mergedResponse.__submitted_at = new Date().toISOString();
  }

  if (existing) {
    await tenantPool.query(QUERIES.UPDATE_RESPONSE, [
      JSON.stringify(mergedResponse),
      existing.id,
    ]);
    console.log("✅ [SERVICE] Response updated id:", existing.id);
    return existing.id;
  }

  const [result] = await tenantPool.query(QUERIES.SUBMIT_RESPONSE, [
    formId,
    targetEmployeeId,
    orgId,
    JSON.stringify(mergedResponse),
  ]);

  console.log("✅ [SERVICE] Response saved with ID:", result.insertId);
  return result.insertId;
};

/* ------------------------------------------------ */
/* GET FORM RESPONSES */
/* ------------------------------------------------ */
const getResponses = async (orgId, formId) => {
  console.log("📊 [SERVICE] Fetching responses for form:", formId);

  const tenantPool = await getTenantPoolByOrgId(orgId);

  const [rows] = await tenantPool.query(QUERIES.GET_RESPONSES, [formId, orgId]);

  console.log("📊 [SERVICE] Responses found:", rows.length);

  return rows;
};

/* ------------------------------------------------ */
/* ASSIGN FORM TO EMPLOYEES */
/* ------------------------------------------------ */
// const assignFormToEmployees = async (
//   orgId,
//   formId,
//   employeeIds,
//   { replaceExisting = false } = {}
// ) => {
//   const tenantPool = await getTenantPoolByOrgId(orgId);

//   if (replaceExisting) {
//     await tenantPool.query(QUERIES.DELETE_EMPLOYEE_ASSIGNMENTS, [formId]);
//   }

//   const [alreadyAssigned] = await tenantPool.query(
//     `SELECT assigned_to_id FROM form_assignments WHERE form_id = ? AND assigned_to_type = 'EMPLOYEE'`,
//     [formId]
//   );
//   const assignedSet = new Set(alreadyAssigned.map((row) => String(row.assigned_to_id)));

//   let inserted = 0;

//   for (const empId of employeeIds) {
//     const empKey = String(empId);
//     if (assignedSet.has(empKey) && !replaceExisting) continue;

//     await tenantPool.query(QUERIES.ASSIGN_FORM_TO_EMPLOYEES, [
//       formId,
//       "EMPLOYEE",
//       empId,
//     ]);
//     inserted += 1;
//   }

//   return inserted;
// };
/* ------------------------------------------------ */
/* ASSIGN FORM TO EMPLOYEES - FIXED & IMPROVED */
/* ------------------------------------------------ */
const assignFormToEmployees = async (
  orgId,
  formId,
  employeeIds,
  { replaceExisting = false } = {}
) => {
  const tenantPool = await getTenantPoolByOrgId(orgId);

  console.log(`[SERVICE] Assigning form ${formId} to ${employeeIds.length} employees (org: ${orgId})`);

  // Delete existing assignments if replaceExisting is true
  if (replaceExisting) {
    await tenantPool.query(
      `DELETE FROM form_assignments 
       WHERE form_id = ? AND assigned_to_type = 'EMPLOYEE' AND org_id = ?`,
      [formId, orgId]
    );
    console.log(`[SERVICE] Replaced all previous assignments for form ${formId}`);
  }

  // Get current assignments for this form + org
  const [alreadyAssigned] = await tenantPool.query(
    `SELECT assigned_to_id 
     FROM form_assignments 
     WHERE form_id = ? 
       AND assigned_to_type = 'EMPLOYEE'
       AND org_id = ?`,
    [formId, orgId]
  );

  const assignedSet = new Set(alreadyAssigned.map(row => String(row.assigned_to_id)));

  let inserted = 0;

  for (const empId of employeeIds) {
    const empKey = String(empId);
    if (assignedSet.has(empKey) && !replaceExisting) {
      console.log(`[SERVICE] Employee ${empId} already assigned → skipping`);
      continue;
    }

    // Insert with org_id
    await tenantPool.query(QUERIES.ASSIGN_FORM_TO_EMPLOYEES, [
      formId,
      orgId,
      "EMPLOYEE",
      empId
    ]);

    inserted += 1;
    console.log(`[SERVICE] Successfully assigned form ${formId} to employee ${empId}`);
  }

  console.log(`[SERVICE] Total new assignments: ${inserted}`);
  return inserted;
};
/* ------------------------------------------------ */
/* GET ASSIGNED FORMS FOR EMPLOYEE */
/* ------------------------------------------------ */
const getAssignedForms = async (orgId, employeeId) => {
  console.log("📋 [SERVICE] Fetching assigned forms for employee:", employeeId);

  const tenantPool = await getTenantPoolByOrgId(orgId);

  const [rows] = await tenantPool.query(QUERIES.GET_ASSIGNED_FORMS, [employeeId]);

  console.log("📊 [SERVICE] Assigned forms found:", rows.length);

  return rows;
};
/* ------------------------------------------------ */
/* GET TEAM SUBMISSIONS FOR SUPERVISOR             */
/* ------------------------------------------------ */
/* ------------------------------------------------ */
/* GET TEAM SUBMISSIONS FOR SUPERVISOR             */
/* ------------------------------------------------ */
/* ------------------------------------------------ */
/* GET TEAM SUBMISSIONS FOR SUPERVISOR             */
/* ------------------------------------------------ */
// const getTeamSubmissions = async (orgId, supervisorId) => {
//   console.log(`[SERVICE] Fetching team submissions for supervisor: ${supervisorId}, org: ${orgId}`);

//   const tenantPool = await getTenantPoolByOrgId(orgId);

//   try {
//     const [rows] = await tenantPool.query(`
//       SELECT 
//         fr.*,
//         ft.form_name,
//         ft.form_type,
//         ft.active_from,           -- ← ADD THIS
//         ft.active_to,             -- ← ADD THIS
//         e.employee_id,
//         e.first_name,
//         e.middle_name,
//         e.last_name,
//         CONCAT(
//           COALESCE(e.first_name, ''), ' ', 
//           COALESCE(e.middle_name, ''), ' ', 
//           COALESCE(e.last_name, '')
//         ) AS employee_name,
//         fr.submitted_at
//       FROM form_responses1 fr
//       INNER JOIN form_templates ft 
//         ON fr.form_id = ft.id
//       INNER JOIN employees e 
//         ON fr.employee_id = e.employee_id
//       INNER JOIN employee_professional ep 
//         ON e.employee_id = ep.employee_id

//       WHERE fr.org_id = ?
//         AND ep.supervisor_id = ?
//         AND ft.form_type = 'employee_supervisor'

//       ORDER BY fr.submitted_at DESC;
//     `, [orgId, supervisorId]);

//     console.log(`[SERVICE] Team submissions found: ${rows.length}`);
//     if (rows.length > 0) {
//       console.log("Sample submission with dates:", {
//         form_name: rows[0].form_name,
//         active_from: rows[0].active_from,
//         active_to: rows[0].active_to
//       });
//     }
//     return rows;
//   } catch (err) {
//     console.error("[SERVICE] Get team submissions error:", err.message || err);
//     throw err;
//   }
// };

const getTeamSubmissions = async (orgId, supervisorId) => {
  console.log(`[SERVICE] Fetching team submissions → Org: ${orgId} | Supervisor: ${supervisorId}`);

  const tenantPool = await getTenantPoolByOrgId(orgId);

  try {
   const [rows] = await tenantPool.query(`
  SELECT 
    fr.*,

    ft.id AS form_id,
    ft.form_name,
    ft.form_type,
    ft.active_from,
    ft.active_to,

    e.employee_id,
    e.first_name,
    e.middle_name,
    e.last_name,

    CONCAT(
      COALESCE(e.first_name,''), ' ',
      COALESCE(e.middle_name,''), ' ',
      COALESCE(e.last_name,'')
    ) AS employee_name

  FROM form_responses1 fr

  INNER JOIN form_templates ft
    ON fr.form_id = ft.id

  INNER JOIN employees e
    ON fr.employee_id COLLATE utf8mb4_general_ci =
       e.employee_id COLLATE utf8mb4_general_ci

  INNER JOIN employee_professional ep
    ON e.employee_id COLLATE utf8mb4_general_ci =
       ep.employee_id COLLATE utf8mb4_general_ci

  WHERE ep.supervisor_id COLLATE utf8mb4_general_ci = ?
    AND fr.org_id = ?

  ORDER BY fr.submitted_at DESC

`, [supervisorId, orgId]);

    console.log(`[SERVICE] ✅ Team submissions found: ${rows.length}`);
    return rows || [];

  } catch (err) {
    console.error("❌ [SERVICE] Team submissions query failed:", err.message);
    return [];
  }
};
const getFormAssignedEmployees = async (orgId, formId) => {
  console.log(`[SERVICE] Fetching assigned employees for form: ${formId}, org: ${orgId}`);

  const tenantPool = await getTenantPoolByOrgId(orgId);

  try {
    const [rows] = await tenantPool.query(`
      SELECT 
        e.employee_id,
        e.first_name,
        e.middle_name,
        e.last_name
      FROM form_assignments fa
      INNER JOIN employees e 
        ON fa.assigned_to_id COLLATE utf8mb4_0900_ai_ci = e.employee_id
      WHERE fa.form_id = ?
        AND fa.assigned_to_type = 'EMPLOYEE'
        AND fa.org_id = ?
      ORDER BY e.first_name ASC, e.last_name ASC
    `, [formId, orgId]);

    console.log(`[SERVICE] ✅ Found ${rows.length} assigned employees for form ${formId}`);
    return rows;
  } catch (err) {
    console.error("[SERVICE] Query error in getFormAssignedEmployees:", err.message);
    throw err;
  }
};
module.exports = {
  createForm,
  updateForm,
  getForms,           // ← This was missing or not exported
  getFormById,        // ← This was missing or not exported
  submitResponse,
  getResponses,
  assignFormToEmployees,
  getAssignedForms,
  getTeamSubmissions,
  getFormAssignedEmployees,
};