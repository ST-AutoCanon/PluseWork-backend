
const service = require("../services/forms.services");

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

    const id = await service.createForm(
      orgId,
      form_name,
      form_json,
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

    await service.updateForm(
      orgId,
      id,
      form_name,
      form_json,
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
exports.submitForm = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];
    const employeeId = req.headers["x-employee-id"];

    const { id } = req.params;
    const { response_json, isReview, reviewedEmployeeId } = req.body;

    await service.submitResponse(
      orgId,
      id,
      employeeId,
      response_json,
      {
        isReview: Boolean(isReview),
        reviewedEmployeeId: reviewedEmployeeId || null,
      }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ [HANDLER] submitForm error:", err);
    res.status(500).json({ error: "Submission failed" });
  }
};

/* ------------------------------------------------ */
/* GET RESPONSES */
/* ------------------------------------------------ */
exports.getResponses = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];
    const { id } = req.params;

    const responses = await service.getResponses(orgId, id);

    res.json({ data: responses });
  } catch (err) {
    console.error("❌ [HANDLER] getResponses error:", err);
    res.status(500).json({ error: "Failed to fetch responses" });
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