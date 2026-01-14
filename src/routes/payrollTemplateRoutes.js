const express = require("express");
const {
  getSalaryPreferencesHandler,
  getTemplateHandler,
  saveSalaryPreferencesHandler,
} = require("../handlers/payrollTemplateHandler");

const router = express.Router();

router.get("/salary-preferences", getSalaryPreferencesHandler);

router.post("/salary-preferences", saveSalaryPreferencesHandler);

router.get("/test-new-route", (req, res) => {
  res.json({ message: "🚀 NEW ROUTES WORKING!" });
});

router.get(
  "/orgs/:orgId/templates/:templateId",
  (req, res, next) => {
    req.params.templateId = req.params.templateId;
    next();
  },
  getTemplateHandler
);

module.exports = router;
