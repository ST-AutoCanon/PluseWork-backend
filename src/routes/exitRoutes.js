
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
  saveHrFinalEvaluation,
  directExit,
  
  getAllActiveEmployees,
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
router.put(
  "/hr-final-evaluation/:id",
  saveHrFinalEvaluation
);
// Add this alongside the existing one
router.get("/hr/resigned-clearance", getHrResignedClearance);
// Inside your router
router.post("/direct-exit", directExit);   // ← NEW

router.get("/all-active-employees", getAllActiveEmployees);

module.exports = router;
