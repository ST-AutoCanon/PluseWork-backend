
const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const QUERIES = require("../constants/forms.constants");
// ==================== HELPER FUNCTION ====================
function sanitizeOrgId(raw) {
  if (!raw) return "unknown";
  const s = String(raw).trim();
  return s.replace(/[^a-zA-Z0-9-_]/g, "_") || "unknown";
}
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
/* ------------------------------------------------ */
/* SUBMIT FORM RESPONSE - DRAFT SUPPORT (FIXED) */
/* ------------------------------------------------ */
// const submitResponse = async (
//   orgId,
//   formId,
//   employeeId,
//   responseJson,
//   options = {}
// ) => {
//   console.log(`📥 [SERVICE] ${options.isDraft ? '💾 SAVING DRAFT' : '✅ FINAL SUBMIT'}`, 
//               `Form: ${formId}, Employee: ${employeeId}`);

//   const tenantPool = await getTenantPoolByOrgId(orgId);

//   const form = await getFormById(orgId, formId);
//   if (!form) throw new Error("Form not found");

//   const targetEmployeeId = options.isReview
//     ? (options.reviewedEmployeeId || employeeId)
//     : employeeId;

//   if (!targetEmployeeId) throw new Error("Target employee ID is required");

//   // Check existing response
//   const [existingRows] = await tenantPool.query(
//     QUERIES.GET_RESPONSE_BY_FORM_EMPLOYEE,
//     [formId, targetEmployeeId, orgId]
//   );

//   const existing = existingRows[0];

//   const safeParse = (json) => {
//     if (!json) return {};
//     try {
//       return typeof json === "object" ? json : JSON.parse(json);
//     } catch (_) {
//       return {};
//     }
//   };

//   const existingData = existing ? safeParse(existing.response_json) : {};

//   const mergedResponse = {
//     ...existingData,
//     ...responseJson,
//     __form_id: formId,
//     __org_id: orgId,
//     __employee_id: targetEmployeeId,
//     __last_updated: new Date().toISOString(),
//   };

//   let status = options.isDraft ? 'draft' : 'submitted';

//   if (options.isReview) {
//     mergedResponse.__reviewed_by = employeeId;
//     mergedResponse.__reviewed_at = new Date().toISOString();
//     mergedResponse.__is_review = true;
//     status = 'submitted'; // Reviews are always submitted
//   } else if (options.isDraft) {
//     mergedResponse.__is_draft = true;
//     mergedResponse.__saved_at = new Date().toISOString();
//     mergedResponse.__saved_by = employeeId;
//   } else {
//     mergedResponse.__submitted_by = employeeId;
//     mergedResponse.__submitted_at = new Date().toISOString();
//     mergedResponse.__is_draft = false;
//   }

//   if (existing) {
//     // UPDATE EXISTING
//     await tenantPool.query(QUERIES.UPDATE_RESPONSE, [
//       JSON.stringify(mergedResponse),   // response_json
//       status,                           // status
//       existing.id                       // id
//     ]);
//     console.log(`✅ [SERVICE] ${status.toUpperCase()} UPDATED successfully`);
//     return existing.id;
//   } else {
//     // INSERT NEW
//     const [result] = await tenantPool.query(QUERIES.SUBMIT_RESPONSE, [
//       formId,
//       targetEmployeeId,
//       orgId,
//       JSON.stringify(mergedResponse),
//       status
//     ]);
//     console.log(`✅ [SERVICE] New ${status} created with ID:`, result.insertId);
//     return result.insertId;
//   }
// };


////////working version of submitResponse with draft support///////
/* ------------------------------------------------ */
/* SUBMIT FORM RESPONSE - DRAFT + FILE SUPPORT */
/* ------------------------------------------------ */
const submitResponse = async (
  orgId,
  formId,
  employeeId,
  responseJson,
  options = {}
) => {
  console.log(`📥 [SERVICE] ${options.isDraft ? '💾 SAVING DRAFT' : '✅ FINAL SUBMIT'}`, 
              `Form: ${formId}, Employee: ${employeeId}`);

  const tenantPool = await getTenantPoolByOrgId(orgId);

  const form = await getFormById(orgId, formId);
  if (!form) throw new Error("Form not found");

  const targetEmployeeId = options.isReview
    ? (options.reviewedEmployeeId || employeeId)
    : employeeId;

  if (!targetEmployeeId) throw new Error("Target employee ID is required");

  // Check existing response
  const [existingRows] = await tenantPool.query(
    QUERIES.GET_RESPONSE_BY_FORM_EMPLOYEE,
    [formId, targetEmployeeId, orgId]
  );

  const existing = existingRows[0];   // ← This was missing in previous code

  const safeParse = (json) => {
    if (!json) return {};
    try {
      return typeof json === "object" ? json : JSON.parse(json);
    } catch (_) {
      return {};
    }
  };

  let responseData = {};
  try {
    responseData = typeof responseJson === 'string' 
      ? JSON.parse(responseJson) 
      : responseJson || {};
  } catch (e) {
    responseData = {};
  }

  // Process uploaded files (if any)
 // Inside submitResponse function, improve file processing:
if (options.files && options.files.length > 0) {
  options.files.forEach(file => {
    const fieldKey = file.fieldname;
    if (!fieldKey) return;

    if (!responseData[fieldKey]) {
      responseData[fieldKey] = [];
    }

    responseData[fieldKey].push({
      originalname: file.originalname,
      filename: file.filename,
      path: `/FormUploads/${sanitizeOrgId(orgId)}/${file.filename}`,
      mimetype: file.mimetype,
      size: file.size,
      uploaded_at: new Date().toISOString()
    });
  });
}

  const existingData = existing ? safeParse(existing.response_json) : {};

  const mergedResponse = {
    ...existingData,
    ...responseData,
    __form_id: formId,
    __org_id: orgId,
    __employee_id: targetEmployeeId,
    __last_updated: new Date().toISOString(),
  };

  let status = options.isDraft ? 'draft' : 'submitted';

  if (options.isReview) {
    mergedResponse.__reviewed_by = employeeId;
    mergedResponse.__reviewed_at = new Date().toISOString();
    mergedResponse.__is_review = true;
    status = 'submitted';
  } else if (options.isDraft) {
    mergedResponse.__is_draft = true;
    mergedResponse.__saved_at = new Date().toISOString();
    mergedResponse.__saved_by = employeeId;
  } else {
    mergedResponse.__submitted_by = employeeId;
    mergedResponse.__submitted_at = new Date().toISOString();
    mergedResponse.__is_draft = false;
  }

  if (existing) {
    await tenantPool.query(QUERIES.UPDATE_RESPONSE, [
      JSON.stringify(mergedResponse),
      status,
      existing.id
    ]);
    console.log(`✅ [SERVICE] ${status.toUpperCase()} UPDATED successfully`);
    // If this submission requested feedback from other employees, ensure they are assigned the form
    try {
      if (!options.isReview && !options.isDraft) {
        const requested = new Set();
        Object.keys(responseData || {}).forEach(k => {
          if (/_feedback_request_to$/.test(k)) {
            const val = responseData[k];
            if (val) requested.add(String(val));
          }
        });
        if (requested.size > 0) {
          // call assignFormToEmployees to ensure recipients can access the form
          await assignFormToEmployees(orgId, formId, Array.from(requested), { replaceExisting: false });
          console.log(`[SERVICE] Assigned form ${formId} to requested recipients: ${Array.from(requested).join(',')}`);
        }
      }
    } catch (assignErr) {
      console.error("Failed to auto-assign requested recipients:", assignErr);
    }

    return existing.id;
  } else {
    const [result] = await tenantPool.query(QUERIES.SUBMIT_RESPONSE, [
      formId,
      targetEmployeeId,
      orgId,
      JSON.stringify(mergedResponse),
      status
    ]);
    console.log(`✅ [SERVICE] New ${status} created with ID:`, result.insertId);
    // After creating a new response, also auto-assign requested recipients if any
    try {
      if (!options.isReview && !options.isDraft) {
        const requested = new Set();
        Object.keys(responseData || {}).forEach(k => {
          if (/_feedback_request_to$/.test(k)) {
            const val = responseData[k];
            if (val) requested.add(String(val));
          }
        });
        if (requested.size > 0) {
          await assignFormToEmployees(orgId, formId, Array.from(requested), { replaceExisting: false });
          console.log(`[SERVICE] Assigned form ${formId} to requested recipients: ${Array.from(requested).join(',')}`);
        }
      }
    } catch (assignErr) {
      console.error("Failed to auto-assign requested recipients:", assignErr);
    }

    return result.insertId;
  }
};
/* ------------------------------------------------ */
/* GET FORM RESPONSES */
/* ------------------------------------------------ */
/* ------------------------------------------------ */
/* GET FORM RESPONSES */
/* ------------------------------------------------ */
const getResponses = async (orgId, formId) => {
  console.log(`📊 [SERVICE] Fetching responses for form: ${formId}, org: ${orgId}`);

  if (!orgId || !formId) {
    console.error("❌ Missing orgId or formId");
    return [];
  }

  const tenantPool = await getTenantPoolByOrgId(orgId);

  try {
    const [rows] = await tenantPool.query(QUERIES.GET_RESPONSES, [formId, orgId]);

    console.log(`📊 [SERVICE] Responses found: ${rows.length}`);
    return rows || [];
  } catch (err) {
    console.error("❌ [SERVICE] getResponses query error:", err.message);
    return [];
  }
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

// const getTeamSubmissions = async (orgId, supervisorId) => {
//   console.log(`[SERVICE] Fetching team submissions → Org: ${orgId} | Supervisor: ${supervisorId}`);

//   const tenantPool = await getTenantPoolByOrgId(orgId);

//   try {
//     const [rows] = await tenantPool.query(`
//       SELECT 
//         fr.*,
//         ft.id AS form_id,
//         ft.form_name,
//         ft.form_type,
//         ft.active_from,
//         ft.active_to,
//         e.first_name,
//         e.middle_name,
//         e.last_name,
//         CONCAT(COALESCE(e.first_name,''), ' ', 
//                COALESCE(e.middle_name,''), ' ', 
//                COALESCE(e.last_name,'')) AS employee_name
//       FROM form_responses1 fr
//       LEFT JOIN employees e 
//   ON fr.employee_id = e.employee_id

// LEFT JOIN employee_professional ep 
//   ON e.employee_id = ep.employee_id

// WHERE ep.supervisor_id = ?
//         AND ep.supervisor_id COLLATE utf8mb4_general_ci = ?   -- ← Fixed here
//       ORDER BY fr.submitted_at DESC
//       LIMIT 100;
//     `, [orgId, supervisorId]);

//     console.log(`[SERVICE] ✅ Team submissions found: ${rows.length}`);
//     return rows || [];

//   } catch (err) {
//     console.error("❌ [SERVICE] Team submissions query failed:", err.message);
//     return [];
//   }
// };

const getTeamSubmissions = async (orgId, supervisorId) => {
  console.log(
    `[SERVICE] Fetching team submissions → Org: ${orgId} | Supervisor: ${supervisorId}`
  );

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

      WHERE fr.org_id = ?
        AND ep.supervisor_id COLLATE utf8mb4_general_ci = ?
        AND ft.form_type = 'employee_supervisor'

      ORDER BY fr.submitted_at DESC
      LIMIT 100
    `, [orgId, supervisorId]);

    console.log(`[SERVICE] ✅ Team submissions found: ${rows.length}`);

    return rows || [];

  } catch (err) {
    console.error(
      "❌ [SERVICE] Team submissions query failed:",
      err.message
    );

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

const getFeedbackRequests = async (orgId, employeeId) => {
  console.log(`[SERVICE] Fetching feedback requests for employee ${employeeId} in org ${orgId}`);
  const tenantPool = await getTenantPoolByOrgId(orgId);
  const requests = [];

  const getObjectValue = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const findObjectValue = (obj, targetKey) => {
    if (!obj || typeof obj !== 'object') return null;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = findObjectValue(item, targetKey);
        if (found !== null && found !== undefined) return found;
      }
      return null;
    }

    if (Object.prototype.hasOwnProperty.call(obj, targetKey)) {
      return obj[targetKey];
    }

    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object') {
        const found = findObjectValue(value, targetKey);
        if (found !== null && found !== undefined) return found;
      }
    }

    return null;
  };

  const safelyParseJson = (value) => {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch (err) {
      return null;
    }
  };

  const getFieldLabelFromFormJson = (formJson, targetFieldId) => {
    const json = safelyParseJson(formJson);
    if (!json) return null;

    const normalizedTarget = String(targetFieldId || "");

    const getLabelFromObject = (obj) => {
      if (!obj || typeof obj !== 'object') return null;
      return obj.label || obj.title || obj.name || obj.placeholder || obj.question || obj.displayName || null;
    };

    const matchesFieldId = (value) => {
      if (value === undefined || value === null) return false;
      return String(value) === normalizedTarget;
    };

    const scanForLabel = (obj) => {
      if (!obj || typeof obj !== 'object') return null;

      if (Array.isArray(obj)) {
        for (const item of obj) {
          const found = scanForLabel(item);
          if (found) return found;
        }
        return null;
      }

      const objectLabel = getLabelFromObject(obj);
      if ((matchesFieldId(obj.id) || matchesFieldId(obj.fieldId) || matchesFieldId(obj.name)) && objectLabel) {
        return objectLabel;
      }

      if (obj.employee && (matchesFieldId(obj.employee.id) || matchesFieldId(obj.employee.fieldId) || matchesFieldId(obj.employee.name))) {
        return getLabelFromObject(obj.employee);
      }

      if (obj.supervisor && (matchesFieldId(obj.supervisor.id) || matchesFieldId(obj.supervisor.fieldId) || matchesFieldId(obj.supervisor.name))) {
        return getLabelFromObject(obj.supervisor);
      }

      if (obj.supervisorFields && Array.isArray(obj.supervisorFields)) {
        for (const field of obj.supervisorFields) {
          const found = scanForLabel(field);
          if (found) return found;
        }
      }

      for (const value of Object.values(obj)) {
        if (value && typeof value === 'object') {
          const found = scanForLabel(value);
          if (found) return found;
        }
      }

      return null;
    };

    return scanForLabel(json);
  };

  const scanObjectForRequests = (obj, row) => {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      obj.forEach((item) => scanObjectForRequests(item, row));
      return;
    }

    Object.entries(obj).forEach(([key, value]) => {
      if (/_feedback_request_to$/.test(key)) {
        const requestedFor = getObjectValue(value);
        if (String(requestedFor) === String(employeeId)) {
          const fieldId = key.replace(/_feedback_request_to$/, '');
          const rawFieldLabel = getFieldLabelFromFormJson(row.form_json, fieldId);
          const fieldLabel = rawFieldLabel || null;
          let fieldValue = getObjectValue(obj[fieldId]);
          if (!fieldValue) {
            fieldValue = getObjectValue(findObjectValue(row.response_json, fieldId));
          }
          const requestReason =
            getObjectValue(obj[`${fieldId}_feedback_request_reason`]) ||
            getObjectValue(obj[`${fieldId}_feedback_request_comment`]) ||
            getObjectValue(obj[`${fieldId}_feedback_request_note`]) ||
            null;
          const feedbackKey = `${fieldId}_others_feedback_from_${employeeId}`;
          const providedValue = row.response_json ? row.response_json[feedbackKey] : undefined;
          const alreadyProvided = providedValue !== undefined && providedValue !== null && String(providedValue).trim() !== "";

          // Always include the request so the UI can show requests even after responding.
          requests.push({
            form_id: row.form_id,
            form_name: row.form_name || null,
            requester_id: row.employee_id,
            requester_first_name: row.requester_first_name || null,
            requester_last_name: row.requester_last_name || null,
            fieldId,
            fieldLabel: fieldLabel || fieldValue || fieldId,
            fieldValue,
            requestContext: fieldValue,
            requestReason,
            requestKey: key,
            feedbackKey,
            recipient_id: employeeId,
            alreadyProvided,
            providedValue: alreadyProvided ? providedValue : null,
            requesterResponseSubmittedAt: row.submitted_at || row.__submitted_at || null,
          });
        }
      }

      if (value && typeof value === 'object') {
        scanObjectForRequests(value, row);
      }
    });
  };

  try {
    const [rows] = await tenantPool.query(QUERIES.GET_RESPONSES_BY_ORG, [orgId]);
    (rows || []).forEach((r) => {
      try {
        const respJson = typeof r.response_json === 'string' ? JSON.parse(r.response_json) : r.response_json || {};
        r.response_json = respJson;
        scanObjectForRequests(respJson, r);
      } catch (err) {
        // ignore parse errors
      }
    });
    return requests;
  } catch (err) {
    console.error("[SERVICE] getFeedbackRequests failed:", err.message);
    return [];
  }
};

const submitOthersFeedback = async (orgId, formId, requesterId, recipientId, feedbackEntries) => {
  console.log(`[SERVICE] submitOthersFeedback: form ${formId}, requester ${requesterId}, recipient ${recipientId}`);
  console.log(`[SERVICE] Received feedbackEntries:`, feedbackEntries);

  const tenantPool = await getTenantPoolByOrgId(orgId);

  // Find existing response for the ORIGINAL requester
  const [existingRows] = await tenantPool.query(
    QUERIES.GET_RESPONSE_BY_FORM_EMPLOYEE, 
    [formId, requesterId, orgId]
  );

  const existing = existingRows[0];

  const safeParse = (json) => {
    if (!json) return {};
    try { 
      return typeof json === 'object' ? json : JSON.parse(json); 
    } catch (_) { 
      return {}; 
    }
  };

  let existingData = existing ? safeParse(existing.response_json) : {};

  let hasChanges = false;

  // === FIXED MERGING LOGIC ===
  Object.keys(feedbackEntries || {}).forEach(baseField => {
    const value = feedbackEntries[baseField];

    if (value && String(value).trim() !== "") {
      // Store under: {fieldId}_others_feedback_from_{recipientId}
      const destKey = `${baseField}_others_feedback_from_${recipientId}`;
      
      existingData[destKey] = value;
      hasChanges = true;

      console.log(`[SERVICE] Saved feedback: ${destKey} = ${value}`);
    }
  });

  if (!hasChanges) {
    console.log("[SERVICE] No changes to save");
    return existing ? existing.id : null;
  }

  if (existing) {
    // Update existing response
    await tenantPool.query(QUERIES.UPDATE_RESPONSE, [
      JSON.stringify(existingData),
      'submitted',
      existing.id
    ]);
    console.log(`[SERVICE] Updated existing response with ID: ${existing.id}`);
    return existing.id;
  } else {
    // Create new response (rare case)
    const [result] = await tenantPool.query(QUERIES.SUBMIT_RESPONSE, [
      formId,
      requesterId,
      orgId,
      JSON.stringify(existingData),
      'submitted'
    ]);
    console.log(`[SERVICE] Created new response with ID: ${result.insertId}`);
    return result.insertId;
  }
};

module.exports = {
  createForm,
  updateForm,
  getForms,
  getFormById,
  submitResponse,
  getResponses,
  assignFormToEmployees,
  getAssignedForms,
  getTeamSubmissions,
  getFormAssignedEmployees,
  getFeedbackRequests,
  submitOthersFeedback,
};