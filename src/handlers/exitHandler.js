

const exitService = require("../services/exitService");

module.exports = {
  // Employee
  applyResignation,
  requestWithdrawal,
  getMyActive,

  // Supervisor
  getSupervisorPending,
  supervisorNormalAction,
  supervisorWithdrawalAction,
  getMyTeamAllRequests,
  getAllOrgExitRequests,

  // HR
  getHrPending,
  hrNormalAction,
  hrFinalApproveResign: hrApproveResignation,
  hrFinalApproveWithdraw: hrApproveWithdrawal,

  // Clearance
  employeeProposeClearanceDates,
  getHrResignedClearance,
  hrUpdateClearance,
  hrSetFinalPlannedDates,

  // NEW
  saveHrFinalEvaluation
};

// ───────────────────────────────────────────────
//  Handlers implementations
// ───────────────────────────────────────────────

async function applyResignation(req, res) {
  try {
    const orgId = req.headers["x-org-id"];
    const employeeId = req.headers["x-employee-id"];
    const { reason, otherReason, proposedLwd, comment } = req.body;

    const result = await exitService.applyResignation({
      orgId, employeeId, reason, otherReason, proposedLwd, comment,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

async function getMyTeamAllRequests(req, res) {
  try {
    const orgId = req.headers["x-org-id"];
    const currentEmployeeId = req.headers["x-employee-id"];

    if (!orgId || !currentEmployeeId) {
      return res.status(400).json({ success: false, error: "Missing orgId or employeeId" });
    }

    const requests = await exitService.getMyTeamAllRequests(orgId, currentEmployeeId);
    
    res.json({ success: true, data: requests });
  } catch (err) {
    console.error("getMyTeamAllRequests error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getAllOrgExitRequests(req, res) {
  try {
    const orgId = req.headers["x-org-id"];

    if (!orgId) {
      return res.status(400).json({ success: false, error: "Missing orgId" });
    }

    const requests = await exitService.getAllOrgExitRequests(orgId);
    
    res.json({ success: true, data: requests });
  } catch (err) {
    console.error("getAllOrgExitRequests error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
async function requestWithdrawal(req, res) {
  try {
    const orgId = req.headers["x-org-id"];
    const employeeId = req.headers["x-employee-id"];
    const { exitId, reason } = req.body;

    const result = await exitService.requestWithdrawal({ orgId, employeeId, exitId, reason });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

async function getMyActive(req, res) {
  try {
    const orgId = req.headers["x-org-id"];
    const employeeId = req.headers["x-employee-id"];
    if (!orgId || !employeeId) {
      return res.status(400).json({ success: false, error: "Missing orgId or employeeId" });
    }
    const activeRequest = await exitService.getMyActiveRequest(orgId, employeeId);
    res.json({ success: true, data: activeRequest });
  } catch (err) {
    console.error("Error fetching my active request:", err);
    res.status(500).json({ success: false, error: "Could not fetch active request" });
  }
}

// Supervisor ──────────────────────────────────────
async function getSupervisorPending(req, res) {
  try {
    const orgId = req.headers["x-org-id"];
    const normal = await exitService.getSupervisorPending(orgId);
    const withdraw = await exitService.getSupervisorWithdrawPending(orgId);
    res.json({ success: true, normal, withdraw });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function supervisorNormalAction(req, res) {
  try {
    const orgId = req.headers["x-org-id"];
    const actionBy = req.headers["x-employee-id"];
    const { exitId, status, recommendedLwd, comment } = req.body;

    console.log("[SUPERVISOR ACTION] Processing:", { exitId, orgId, status, actionBy });

    const result = await exitService.supervisorNormalAction({
      orgId, exitId, status, recommendedLwd, comment, actionBy,
    });
    
    console.log("[SUPERVISOR ACTION] Success:", result);
    res.json({ success: true, message: "Action processed", data: result });
  } catch (err) {
    console.error("[SUPERVISOR ACTION] Error:", err.message);
    res.status(400).json({ success: false, error: err.message });
  }
}

async function supervisorWithdrawalAction(req, res) {
  try {
    const orgId = req.headers["x-org-id"];
    const { exitId, status, comment } = req.body;
    await exitService.supervisorWithdrawalAction({ orgId, exitId, status, comment });
    res.json({ success: true, message: "Withdrawal decision saved" });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

// HR ──────────────────────────────────────────────
async function getHrPending(req, res) {
  try {
    const orgId = req.headers["x-org-id"];
    const normal = await exitService.getHrPending(orgId);
    const withdraw = await exitService.getHrWithdrawPending(orgId);
    res.json({ success: true, normal, withdraw });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function hrNormalAction(req, res) {
  try {
    const orgId = req.headers["x-org-id"];
    const actionBy = req.headers["x-employee-id"];
    const { exitId, status, finalLwd, comment } = req.body;

    await exitService.hrNormalAction({
      orgId, exitId, status, finalLwd, comment, actionBy,
    });
    res.json({ success: true, message: "Action processed" });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}
async function hrApproveResignation(req, res) {
  try {
    const orgId = req.headers["x-org-id"];
    const actionBy = req.headers["x-employee-id"];
    
    // Extract ALL expected fields from req.body
    const { exitId, finalLwd, comment, leavePolicy } = req.body;

    // Basic validation
    if (!exitId || !finalLwd) {
      return res.status(400).json({ 
        success: false, 
        error: "exitId and finalLwd are required" 
      });
    }

    // Optional: validate leavePolicy if provided
    const validPolicies = ['all', 'sick_only', 'none'];
    if (leavePolicy && !validPolicies.includes(leavePolicy)) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid leave policy value. Must be 'all', 'sick_only' or 'none'" 
      });
    }

    await exitService.hrApproveResignation({
      orgId,
      exitId,
      finalLwd,
      comment: comment || null,
      leavePolicy: leavePolicy || null,     // ← pass it (null if not sent)
      actionBy,
    });

    res.json({ success: true, message: "Resignation fully approved" });
  } catch (err) {
    console.error("[hrApproveResignation] Error:", err.message);
    res.status(400).json({ success: false, error: err.message });
  }
}

// async function hrApproveResignation(req, res) {
//   try {
//     const orgId = req.headers["x-org-id"];
//     const actionBy = req.headers["x-employee-id"];
//     const { exitId, finalLwd, comment } = req.body;

//     await exitService.hrApproveResignation({
//       orgId, exitId, finalLwd, comment, actionBy,
//     });
//     res.json({ success: true, message: "Resignation fully approved" });
//   } catch (err) {
//     res.status(400).json({ success: false, error: err.message });
//   }
// }

async function hrApproveWithdrawal(req, res) {
  try {
    const orgId = req.headers["x-org-id"];
    const actionBy = req.headers["x-employee-id"];
    const { exitId, comment } = req.body;

    await exitService.hrApproveWithdrawal({ orgId, exitId, comment, actionBy });
    res.json({ success: true, message: "Withdrawal fully approved" });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

// Clearance ───────────────────────────────────────
async function employeeProposeClearanceDates(req, res) {
  try {
    const orgId = req.headers["x-org-id"];
    const employeeId = req.headers["x-employee-id"];
    const { exitId, ktProposedDate, assetsProposedDate } = req.body;

    await exitService.employeeProposeClearanceDates({
      orgId, employeeId, exitId, ktProposedDate, assetsProposedDate,
    });

    res.json({ success: true, message: "Proposed dates submitted" });
  } catch (err) {
    console.error("employeeProposeClearanceDates error:", err);
    res.status(400).json({ success: false, error: err.message });
  }
}

async function getHrResignedClearance(req, res) {
  try {
    const orgId = req.headers["x-org-id"];
    const resigned = await exitService.getHrResignedClearance(orgId);
    res.json({ success: true, resigned });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function hrUpdateClearance(req, res) {
  try {
    const orgId = req.headers["x-org-id"];
    const { exitId, ktCompleted, assetsReturned } = req.body;

    await exitService.hrUpdateClearanceStatus({
      orgId,
      exitId,
      ktCompleted: !!ktCompleted,
      assetsReturned: !!assetsReturned,
    });

    res.json({ success: true, message: "Clearance status updated" });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}
async function saveHrFinalEvaluation(req, res) {
  try {
    const orgId = req.headers["x-org-id"];
    const { id } = req.params;

    const {
      final_lwd,
      hr_rating,
      hr_evaluation_comments
    } = req.body;

    await exitService.saveHrFinalEvaluation(
      orgId,
      id,
      final_lwd,
      hr_rating,
      hr_evaluation_comments
    );

    return res.status(200).json({
      success: true,
      message: "HR final evaluation saved successfully"
    });
  } catch (error) {
    console.error("saveHrFinalEvaluation error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
}
async function hrSetFinalPlannedDates(req, res) {
  try {
    const orgId = req.headers["x-org-id"];
    const { exitId, ktPlannedDate, assetsPlannedDate } = req.body;

    await exitService.hrSetFinalPlannedDates({
      orgId,
      exitId,
      ktPlannedDate: ktPlannedDate || null,
      assetsPlannedDate: assetsPlannedDate || null,
    });

    res.json({ success: true, message: "Final planned dates updated" });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }

  
}
