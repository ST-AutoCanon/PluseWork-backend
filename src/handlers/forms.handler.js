
const service = require("../services/forms.services");

const sanitizeFieldKey = (fieldname) => {
  if (!fieldname) return null;
  const prefix = "referenceFile_";
  return fieldname.startsWith(prefix) ? fieldname.slice(prefix.length) : fieldname;
};

const sanitizeOrgId = (raw) => {
  if (!raw) return "unknown";
  const s = String(raw).trim();
  return s.replace(/[^a-zA-Z0-9-_]/g, "_") || "unknown";
};

const attachReferenceFilesToFormJson = (orgId, formJson, files) => {
  if (!files || !Array.isArray(files) || files.length === 0) return formJson;

  let parsed = formJson;
  if (typeof formJson === "string") {
    try {
      parsed = JSON.parse(formJson);
    } catch (err) {
      console.warn("Could not parse form_json for reference files:", err);
      return formJson;
    }
  }

  if (!Array.isArray(parsed)) return parsed;

  files.forEach((file) => {
    const fieldKey = sanitizeFieldKey(file.fieldname);
    if (!fieldKey) return;

    const field = parsed.find((f) => f.id === fieldKey || f.fieldId === fieldKey);
    if (!field) return;

    const fileInfo = {
      filename: file.filename,
      originalname: file.originalname,
      path: `/FormUploads/${sanitizeOrgId(orgId)}/${file.filename}`,
      mimetype: file.mimetype,
      size: file.size,
      uploaded_at: new Date().toISOString(),
    };

    if (field.employee && field.employee.referenceFile) {
      field.employee.referenceFile = fileInfo;
    } else if (field.supervisor && field.supervisor.referenceFile) {
      field.supervisor.referenceFile = fileInfo;
    } else {
      field.referenceFile = fileInfo;
    }
  });

  return parsed;
};

/* ------------------------------------------------ */
/* CREATE FORM */
/* ------------------------------------------------ */
/* ------------------------------------------------ */
/* CREATE FORM */
/* ------------------------------------------------ */
exports.createForm = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];

    const { 
      form_name, 
      form_json, 
      layout, 
      form_type = "employee_only", 
      active_from, 
      active_to 
    } = req.body;

    const formJsonWithFiles = attachReferenceFilesToFormJson(orgId, form_json, req.files);

    const id = await service.createForm(
      orgId,
      form_name,
      formJsonWithFiles,
      layout,
      form_type,
      active_from,
      active_to
    );

    res.json({ success: true, id });
  } catch (err) {
    console.error("❌ [HANDLER] createForm error:", err);
    res.status(500).json({ error: "Failed to create form" });
  }
};

/* ------------------------------------------------ */
/* UPDATE FORM */
/* ------------------------------------------------ */
exports.updateForm = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];
    const { id } = req.params;

    const { 
      form_name, 
      form_json, 
      layout, 
      form_type = "employee_only", 
      active_from, 
      active_to 
    } = req.body;

    const formJsonWithFiles = attachReferenceFilesToFormJson(orgId, form_json, req.files);

    await service.updateForm(
      orgId,
      id,
      form_name,
      formJsonWithFiles,
      layout,
      form_type,
      active_from,
      active_to
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ [HANDLER] updateForm error:", err);
    res.status(500).json({ error: "Update failed" });
  }
};

/* ------------------------------------------------ */
/* UPDATE FORM */
/* ------------------------------------------------ */
// exports.updateForm = async (req, res) => {
//   try {
//     const orgId = req.headers["x-org-id"];
//     const { id } = req.params;

//     const { form_name, form_json, layout, form_type = "employee_only", active_until } = req.body;

//     await service.updateForm(
//       orgId,
//       id,
//       form_name,
//       form_json,
//       layout,
//       form_type,
//       active_until
//     );

//     res.json({ success: true });
//   } catch (err) {
//     console.error("❌ [HANDLER] updateForm error:", err);
//     res.status(500).json({ error: "Update failed" });
//   }
// };

/* ------------------------------------------------ */
/* GET ALL FORMS */
/* ------------------------------------------------ */
exports.getForms = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];

    const forms = await service.getForms(orgId);

    res.json({ data: forms });
  } catch (err) {
    console.error("❌ [HANDLER] getForms error:", err);
    res.status(500).json({ error: "Failed to fetch forms" });
  }
};

/* ------------------------------------------------ */
/* GET FORM BY ID */
/* ------------------------------------------------ */
exports.getFormById = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];
    const { id } = req.params;

    const form = await service.getFormById(orgId, id);

    res.json({ data: form });
  } catch (err) {
    console.error("❌ [HANDLER] getFormById error:", err);
    res.status(500).json({ error: "Form not found" });
  }
};

/* ------------------------------------------------ */
/* SUBMIT FORM */
/* ------------------------------------------------ */
// exports.submitForm = async (req, res) => {
//   try {
//     const orgId = req.headers["x-org-id"];
//     const employeeId = req.headers["x-employee-id"];

//     const { id } = req.params;
//     const { response_json, isReview, reviewedEmployeeId } = req.body;

//     await service.submitResponse(
//       orgId,
//       id,
//       employeeId,
//       response_json,
//       {
//         isReview: Boolean(isReview),
//         reviewedEmployeeId: reviewedEmployeeId || null,
//       }
//     );

//     res.json({ success: true });
//   } catch (err) {
//     console.error("❌ [HANDLER] submitForm error:", err);
//     res.status(500).json({ error: "Submission failed" });
//   }
// };



/* ------------------------------------------------ */
/* SUBMIT FORM - WITH FILE SUPPORT */
/* ------------------------------------------------ */
exports.submitForm = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];
    const employeeId = req.headers["x-employee-id"];
    const { id } = req.params;

    const { 
      response_json, 
      isReview, 
      reviewedEmployeeId,
      isDraft = false 
    } = req.body;

    await service.submitResponse(
      orgId,
      id,
      employeeId,
      response_json,
      {
        isReview: Boolean(isReview),
        reviewedEmployeeId: reviewedEmployeeId || null,
        isDraft: Boolean(isDraft),
        files: req.files || []   // ← Files from multer
      }
    );

    res.json({ 
      success: true, 
      message: isDraft ? "Draft saved successfully" : "Form submitted successfully" 
    });
  } catch (err) {
    console.error("❌ [HANDLER] submitForm error:", err);
    res.status(500).json({ error: err.message || "Submission failed" });
  }
};
/* ------------------------------------------------ */
/* SUBMIT FORM (Now supports Draft + Final Submit) */
/* ------------------------------------------------ */
// exports.submitForm = async (req, res) => {
//   try {
//     const orgId = req.headers["x-org-id"];
//     const employeeId = req.headers["x-employee-id"];

//     const { id } = req.params;
//     const { 
//       response_json, 
//       isReview, 
//       reviewedEmployeeId,
//       isDraft = false 
//     } = req.body;

//     await service.submitResponse(
//       orgId,
//       id,
//       employeeId,
//       response_json,
//       {
//         isReview: Boolean(isReview),
//         reviewedEmployeeId: reviewedEmployeeId || null,
//         isDraft: Boolean(isDraft)
//       }
//     );

//     res.json({ 
//       success: true, 
//       message: isDraft ? "Draft saved successfully" : "Form submitted successfully" 
//     });
//   } catch (err) {
//     console.error("❌ [HANDLER] submitForm error:", err);
//     res.status(500).json({ error: err.message || "Submission failed" });
//   }
// };
/* ------------------------------------------------ */
/* GET RESPONSES */
/* ------------------------------------------------ */
/* ------------------------------------------------ */
/* GET RESPONSES */
/* ------------------------------------------------ */
exports.getResponses = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];
    const { id } = req.params;

    if (!orgId || !id) {
      return res.status(400).json({ error: "orgId and form id are required" });
    }

    const responses = await service.getResponses(orgId, id);

    res.json({ data: responses });
  } catch (err) {
    console.error("❌ [HANDLER] getResponses error:", err);
    res.status(500).json({ 
      error: "Failed to fetch responses",
      details: err.message 
    });
  }
};

/* ------------------------------------------------ */
/* ASSIGN FORM TO EMPLOYEES */
/* ------------------------------------------------ */
exports.assignForm = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];
    const { id } = req.params;
    const { employeeIds, replaceExisting = false } = req.body;

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({ error: "employeeIds must be a non-empty array" });
    }

    const count = await service.assignFormToEmployees(orgId, id, employeeIds, {
      replaceExisting: Boolean(replaceExisting),
    });

    res.json({
      success: true,
      message: `Form assigned to ${count} employee${count === 1 ? "" : "s"}`,
      mode: replaceExisting ? "replaced" : "appended",
    });
  } catch (err) {
    console.error("❌ [HANDLER] assignForm error:", err);
    res.status(500).json({ error: "Failed to assign form" });
  }
};

/* ------------------------------------------------ */
/* GET ASSIGNED FORMS FOR EMPLOYEE */
/* ------------------------------------------------ */
exports.getAssignedForms = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];
    const employeeId = req.headers["x-employee-id"];

    if (!employeeId) {
      return res.status(400).json({ error: "Employee ID required" });
    }

    const forms = await service.getAssignedForms(orgId, employeeId);

    res.json({ data: forms });
  } catch (err) {
    console.error("❌ [HANDLER] getAssignedForms error:", err);
    res.status(500).json({ error: "Failed to fetch assigned forms" });
  }
};
/* ------------------------------------------------ */
/* GET TEAM SUBMISSIONS (for Supervisor)           */
/* ------------------------------------------------ */
exports.getTeamSubmissions = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];
    const supervisorId = req.headers["x-employee-id"];   // This is YOU (the supervisor)

    if (!orgId || !supervisorId) {
      return res.status(400).json({ error: "orgId and employeeId required" });
    }

    console.log(`[HANDLER] Fetching team submissions for supervisor: ${supervisorId}`);

    const submissions = await service.getTeamSubmissions(orgId, supervisorId);

    console.log(`[HANDLER] Found ${submissions.length} team submissions`);
    res.json({ data: submissions });   // or just submissions if your frontend expects array
  } catch (err) {
    console.error("❌ [HANDLER] getTeamSubmissions error:", err);
    res.status(500).json({ error: "Failed to fetch team submissions" });
  }
};

exports.getFormAssignedEmployees = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];
    const { id: formId } = req.params;

    console.log(`[HANDLER] getFormAssignedEmployees called - formId: ${formId}, orgId: ${orgId}`);

    if (!orgId || !formId) {
      return res.status(400).json({ error: "orgId and formId required" });
    }

    const assignedEmployees = await service.getFormAssignedEmployees(orgId, formId);

    console.log(`[HANDLER] Returning ${assignedEmployees.length} assigned employees`);

    res.json({ 
      success: true,
      data: assignedEmployees 
    });
  } catch (err) {
    console.error("❌ [HANDLER] getFormAssignedEmployees error:", err.message);
    res.status(500).json({ error: "Failed to fetch assigned employees" });
  }
};

exports.getFeedbackRequests = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];
    const employeeId = req.headers["x-employee-id"];
    if (!orgId || !employeeId) return res.status(400).json({ error: "orgId and employeeId required" });
    const requests = await service.getFeedbackRequests(orgId, employeeId);
    res.json({ success: true, data: requests });
  } catch (err) {
    console.error("❌ [HANDLER] getFeedbackRequests error:", err.message);
    res.status(500).json({ error: "Failed to fetch feedback requests" });
  }
};

exports.submitOthersFeedback = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];
    const recipientId = req.headers["x-employee-id"];   // The person providing feedback
    const { id: formId } = req.params;
    const { requesterEmployeeId, feedbackEntries } = req.body;

    if (!orgId || !recipientId || !formId || !requesterEmployeeId) {
      return res.status(400).json({ error: "Required params missing" });
    }

    console.log(`[HANDLER] submitOthersFeedback - Form: ${formId}, Requester: ${requesterEmployeeId}, Recipient: ${recipientId}`);
    console.log(`[HANDLER] Feedback Entries:`, feedbackEntries);

    const id = await service.submitOthersFeedback(
      orgId, 
      formId, 
      requesterEmployeeId, 
      recipientId, 
      feedbackEntries || {}
    );

    res.json({ success: true, id });
  } catch (err) {
    console.error("❌ [HANDLER] submitOthersFeedback error:", err.message);
    res.status(500).json({ error: err.message || "Failed to submit others feedback" });
  }
};