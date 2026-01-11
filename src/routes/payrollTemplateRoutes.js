

const express = require("express");
const {
  getSalaryPreferencesHandler,
  getTemplateHandler,
  saveSalaryPreferencesHandler,   // ← ADD THIS IMPORT
} = require("../handlers/payrollTemplateHandler");

const router = express.Router();

// GET /api/salary-preferences → returns selected_template_id
router.get("/salary-preferences", getSalaryPreferencesHandler);

// NEW: POST /api/salary-preferences → saves month, year, template
router.post("/salary-preferences", saveSalaryPreferencesHandler);

router.get("/test-new-route", (req, res) => {
  res.json({ message: "🚀 NEW ROUTES WORKING!" });
});

// GET /api/orgs/:orgId/templates/:templateId
router.get("/orgs/:orgId/templates/:templateId", (req, res, next) => {
  req.params.templateId = req.params.templateId;
  next();
}, getTemplateHandler);

module.exports = router;