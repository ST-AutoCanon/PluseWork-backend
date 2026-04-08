

const express = require("express");
const router = express.Router();
const handler = require("../handlers/forms.handler");
const employeeHandler = require("../handlers/employees.handler");

// ==================== IMPORTANT: ORDER MATTERS ====================
// Specific routes MUST come BEFORE the dynamic :id route

router.get("/forms", handler.getForms);
router.get("/forms/assigned", handler.getAssignedForms);
router.get("/forms/team-submissions", handler.getTeamSubmissions);   // ← MUST BE HERE

// Dynamic route comes AFTER all specific routes
router.get("/forms/:id", handler.getFormById);

router.post("/forms", handler.createForm);
router.put("/forms/:id", handler.updateForm);
router.post("/forms/:id/submit", handler.submitForm);
router.get("/forms/:id/responses", handler.getResponses);
router.post("/forms/:id/assign", handler.assignForm);
router.get("/forms/:id/assigned", handler.getFormAssignedEmployees);
router.get("/employees", employeeHandler.getEmployees);
router.get("/employees-forms", employeeHandler.getEmployees);

module.exports = router;