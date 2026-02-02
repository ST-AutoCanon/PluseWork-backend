// // routes/exit.js
// const express = require("express");
// const router = express.Router();

// const handlers = require("../handlers/exitHandler");

// // ────────────── Employee ──────────────
// router.post("/apply", handlers.applyResignation);
// router.post("/withdraw", handlers.requestWithdrawal);

// // ────────────── Supervisor ──────────────
// router.get("/supervisor/pending", handlers.getSupervisorPending);
// router.post("/supervisor/action/normal", handlers.supervisorNormalAction);
// router.post("/supervisor/action/withdrawal", handlers.supervisorWithdrawalAction);
// router.get("/my-active", handlers.getMyActive);
// // ────────────── HR ──────────────
// router.get("/hr/pending", handlers.getHrPending);
// router.post("/hr/action/normal", handlers.hrNormalAction);
// router.post("/hr/final/resign", handlers.hrFinalApproveResign);
// router.post("/hr/final/withdraw", handlers.hrFinalApproveWithdraw);
// router.post("/employee/clearance/propose-dates", handlers.employeeProposeClearanceDates);
// router.post("/hr/clearance/update", handlers.hrUpdateClearance);
// router.get("/hr/resigned-clearance", handlers.getHrResignedClearance);
// router.post("/hr/clearance/set-planned-dates", handlers.hrSetFinalPlannedDates);

// module.exports = router;

const express = require("express");
const router = express.Router();

const {
  applyResignation,
  requestWithdrawal,
  getMyActive,
  getSupervisorPending,
  supervisorNormalAction,
  supervisorWithdrawalAction,
  getHrPending,
  hrNormalAction,
  hrFinalApproveResign,
  employeeProposeClearanceDates,
  getHrResignedClearance,
  hrUpdateClearance,
  getMyTeamAllRequests,     // ← new
  getAllOrgExitRequests,
  hrFinalApproveWithdraw,
} = require("../handlers/exitHandler");

// Employee
router.post("/apply", applyResignation);
router.post("/withdraw", requestWithdrawal);
router.get("/my-active", getMyActive);
router.get("/my-team/all", getMyTeamAllRequests);      // for supervisors
router.get("/all", getAllOrgExitRequests);
// Supervisor
router.get("/supervisor/pending", getSupervisorPending);
router.post("/supervisor/action", supervisorNormalAction);
router.post("/supervisor/withdraw", supervisorWithdrawalAction);

// HR
router.get("/hr/pending", getHrPending);
router.post("/hr/action", hrNormalAction);
router.post("/hr/final-approve", hrFinalApproveResign);

// Clearance
router.post("/clearance/propose", employeeProposeClearanceDates);
router.get("/clearance/resigned", getHrResignedClearance);
router.post("/clearance/update", hrUpdateClearance);

// Withdrawal final
router.post("/hr/withdraw/final", hrFinalApproveWithdraw);
// Add this line
router.post("/clearance/update", hrUpdateClearance);
// Add this alongside the existing one
router.get("/hr/resigned-clearance", getHrResignedClearance);
module.exports = router;

// const express = require("express");
// const router = express.Router();

// const {
//   applyResignation,
//   requestWithdrawal,
//   getMyActive,
//   getSupervisorPending,
//   supervisorNormalAction,
//   supervisorWithdrawalAction,
//   getHrPending,
//   hrNormalAction,
//   hrFinalApproveResign,
//   employeeProposeClearanceDates,
//   getHrResignedClearance,
//   hrUpdateClearance,
//   hrFinalApproveWithdraw,
//   hrSetFinalPlannedDates,           // ← added
// } = require("../handlers/exitHandler");

// // Employee
// router.post("/apply", applyResignation);
// router.post("/withdraw", requestWithdrawal);
// router.get("/my-active", getMyActive);

// // Supervisor
// router.get("/supervisor/pending", getSupervisorPending);
// router.post("/supervisor/action", supervisorNormalAction);
// router.post("/supervisor/withdraw", supervisorWithdrawalAction);   // note: was /supervisor/withdraw

// // HR - pending & actions
// router.get("/hr/pending", getHrPending);
// router.post("/hr/action", hrNormalAction);
// router.post("/hr/final/resign", hrFinalApproveResign);           // fixed naming
// router.post("/hr/final/withdraw", hrFinalApproveWithdraw);

// // Clearance
// router.post("/clearance/propose", employeeProposeClearanceDates);
// router.get("/clearance/resigned", getHrResignedClearance);
// router.post("/clearance/update", hrUpdateClearance);
// router.post("/clearance/set-planned-dates", hrSetFinalPlannedDates);   // ← NEW ROUTE
// // Add this new route (keep the existing /clearance/propose too if you want both)
// router.post("/employee/clearance/propose-dates", employeeProposeClearanceDates);
// // Remove duplicate / conflicting lines
// // router.post("/clearance/update", hrUpdateClearance);          ← removed duplicate
// // router.get("/hr/resigned-clearance", getHrResignedClearance); ← removed (use /clearance/resigned)

// module.exports = router;