// // src/handlers/payrollTemplateHandler.js

// const {
//   getSelectedTemplateId,
//   getTemplateById,
// } = require("../services/payrollTemplateService");

// const getOrgIdFromHeaders = (req) => {
//   return (
//     req.headers["x-org-id"] ||
//     req.headers["x-orgid"] ||
//     req.headers["org_id"] ||
//     req.headers["org-id"] ||
//     null
//   );
// };

// const getSalaryPreferencesHandler = async (req, res) => {
//   console.log("🚀 NEW API HIT! /api/salary-preferences");  // ← THIS WILL PROVE IT WORKS
  
//   const orgId = getOrgIdFromHeaders(req);
//   console.log("📍 orgId from headers:", orgId, typeof orgId);
//   console.log("🔍 All headers:", req.headers);

//   if (!orgId) {
//     console.log("❌ No orgId found");
//     return res.status(400).json({ message: "x-org-id header is required" });
//   }

//   try {
//     const selectedTemplateId = await getSelectedTemplateId(orgId);
//     console.log("✅ Final result:", selectedTemplateId);
    
//     res.status(200).json({
//       success: true,
//       data: [{ selected_template_id: selectedTemplateId }],
//     });
//   } catch (error) {
//     console.error("💥 FULL ERROR:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

// const getTemplateHandler = async (req, res) => {
//   const orgId = getOrgIdFromHeaders(req);
//   if (!orgId) {
//     return res.status(400).json({ message: "x-org-id header is required" });
//   }

//   const { templateId } = req.params;
//   if (!templateId) {
//     return res.status(400).json({ message: "templateId is required" });
//   }

//   try {
//     const template = await getTemplateById(orgId, templateId);
//     if (!template) {
//       return res.status(404).json({ message: "Template not found or access denied" });
//     }
//     res.status(200).json(template);
//   } catch (error) {
//     console.error("Error fetching template:", error);
//     if (error.message.includes("Tenant database not found")) {
//       return res.status(404).json({ message: "Organization not found" });
//     }
//     res.status(500).json({ message: "Failed to fetch template" });
//   }
// };

// module.exports = {
//   getSalaryPreferencesHandler,
//   getTemplateHandler,
// };

// src/handlers/payrollTemplateHandler.js

const {
  getSelectedTemplateId,
  getTemplateById,
} = require("../services/payrollTemplateService");

// Reuse the existing save function from the old service (temporary or permanent – works perfectly)
const { savePreferences } = require("../services/salaryPreferenceService");

const getOrgIdFromHeaders = (req) => {
  return (
    req.headers["x-org-id"] ||
    req.headers["x-orgid"] ||
    req.headers["org_id"] ||
    req.headers["org-id"] ||
    null
  );
};

const getSalaryPreferencesHandler = async (req, res) => {
  console.log("🚀 NEW API HIT! /api/salary-preferences");
  
  const orgId = getOrgIdFromHeaders(req);
  console.log("📍 orgId from headers:", orgId, typeof orgId);

  if (!orgId) {
    return res.status(400).json({ message: "x-org-id header is required" });
  }

  try {
    const selectedTemplateId = await getSelectedTemplateId(orgId);
    console.log("✅ Final result:", selectedTemplateId);
    
    res.status(200).json({
      success: true,
      data: [{ selected_template_id: selectedTemplateId }],
    });
  } catch (error) {
    console.error("💥 FULL ERROR:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getTemplateHandler = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);
  if (!orgId) {
    return res.status(400).json({ message: "x-org-id header is required" });
  }

  const { templateId } = req.params;
  if (!templateId) {
    return res.status(400).json({ message: "templateId is required" });
  }

  try {
    const template = await getTemplateById(orgId, templateId);
    if (!template) {
      return res.status(404).json({ message: "Template not found or access denied" });
    }
    res.status(200).json(template);
  } catch (error) {
    console.error("Error fetching template:", error);
    if (error.message.includes("Tenant database not found")) {
      return res.status(404).json({ message: "Organization not found" });
    }
    res.status(500).json({ message: "Failed to fetch template" });
  }
};

// ========== NEW: SAVE PREFERENCES HANDLER ==========
const saveSalaryPreferencesHandler = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);
  if (!orgId) {
    return res.status(400).json({ message: "x-org-id header is required" });
  }

  const { selected_month, selected_year, selected_template_id } = req.body;

  if (!selected_month || !selected_year) {
    return res.status(400).json({
      message: "selected_month and selected_year are required",
    });
  }

  try {
    await savePreferences(orgId, {
      selected_month,
      selected_year,
      selected_template_id: selected_template_id || null,
    });

    res.status(200).json({
      success: true,
      message: "Preferences saved successfully",
    });
  } catch (error) {
    console.error("💥 Error saving salary preferences:", error);
    res.status(500).json({ message: "Failed to save preferences" });
  }
};

module.exports = {
  getSalaryPreferencesHandler,
  getTemplateHandler,
  saveSalaryPreferencesHandler,   // ← NEW EXPORT
};