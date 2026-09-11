// // handlers/employees.handler.js
// const service = require("../services/employees.service");

// exports.getEmployees = async (req, res) => {
//   try {
//     const orgId = req.headers["x-org-id"];

//     if (!orgId) {
//       return res.status(400).json({ error: "x-org-id header is required" });
//     }

//     const employees = await service.getEmployees(orgId);

//     console.log(`📤 [HANDLER] Returning ${employees.length} employees to frontend`);
//     res.json({ data: employees });
//   } catch (err) {
//     console.error("❌ [HANDLER] getEmployees error:", err.message || err);
//     res.status(500).json({
//       error: "Failed to fetch employees",
//       details: err.sqlMessage || err.message
//     });
//   }
//   exports.getFormResponses = async (req, res) => {
//   try {
//     const orgId = req.headers["x-org-id"];
//     const { formId } = req.params;

//     if (!orgId || !formId) {
//       return res.status(400).json({
//         error: "x-org-id and formId are required"
//       });
//     }

//     const data = await service.getFormResponsesWithNames(orgId, formId);

//     console.log(`📤 [HANDLER] Returning ${data.length} responses`);
//     res.json({ data });

//   } catch (err) {
//     console.error("❌ [HANDLER] getFormResponses error:", err.message);
//     res.status(500).json({
//       error: "Failed to fetch form responses",
//       details: err.message
//     });
//   }
// };
// };
const service = require("../services/employees.service");

// ✅ FIRST FUNCTION
exports.getEmployees = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];

    if (!orgId) {
      return res.status(400).json({ error: "x-org-id header is required" });
    }

    const employees = await service.getEmployees(orgId);

    console.log(
      `📤 [HANDLER] Returning ${employees.length} employees to frontend`,
    );
    res.json({ data: employees });
  } catch (err) {
    console.error("❌ [HANDLER] getEmployees error:", err.message || err);
    res.status(500).json({
      error: "Failed to fetch employees",
      details: err.sqlMessage || err.message,
    });
  }
};

// ✅ SECOND FUNCTION (OUTSIDE)
exports.getFormResponses = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];
    const { formId } = req.params;

    if (!orgId || !formId) {
      return res.status(400).json({
        error: "x-org-id and formId are required",
      });
    }

    const data = await service.getFormResponsesWithNames(orgId, formId);

    console.log(`📤 [HANDLER] Returning ${data.length} responses`);
    res.json({ data });
  } catch (err) {
    console.error("❌ [HANDLER] getFormResponses error:", err.message);
    res.status(500).json({
      error: "Failed to fetch form responses",
      details: err.message,
    });
  }
};
