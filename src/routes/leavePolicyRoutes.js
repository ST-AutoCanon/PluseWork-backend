// src/routes/leavePolicyRoutes.js
const express = require("express");
const LeavePolicyHandler = require("../handlers/leavePolicyHandler");
const router = express.Router();

// CRUD for policies (router is expected to be mounted at e.g. '/api/leave-policies')
router.get("/", LeavePolicyHandler.getAllPolicies);
router.post("/", LeavePolicyHandler.createPolicy);
router.put("/:id", LeavePolicyHandler.updatePolicy);
router.delete("/:id", LeavePolicyHandler.deletePolicy);

router.get(
  "/employee/:employeeId/leave-balance",
  LeavePolicyHandler.getLeaveBalanceHandler
);

router.get(
  "/employee/:employeeId/monthly-lop",
  LeavePolicyHandler.getMonthlyLOPHandler
);

router.post(
  "/employee/:employeeId/compute-monthly-lop",
  LeavePolicyHandler.computeMonthlyLOPHandler
);

// Auto-extend recently-ended policies (callable from admin UI).
// NOTE: when this router is mounted at '/api/leave-policies', the full path will be:
// POST /api/leave-policies/auto-extend
router.post("/auto-extend", LeavePolicyHandler.autoExtendHandler);

module.exports = router;
