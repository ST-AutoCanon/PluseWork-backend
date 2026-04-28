


const { getTenantPoolByOrgId } = require("../db/tenantPoolManager"); // ← your connection logic
const Q = require("../constants/exitQueries");

async function applyResignation(data) {
  const { orgId, employeeId, reason, otherReason, proposedLwd, comment } = data;
  const pool = await getTenantPoolByOrgId(orgId);

  const [rows] = await pool.execute(Q.EXISTS_ACTIVE_REQUEST, [orgId, employeeId]);
  if (rows.length > 0) throw new Error("Active resignation already exists");

  await pool.execute(Q.INSERT_NEW_REQUEST, [
    orgId, employeeId, reason, otherReason || null, comment || null, proposedLwd
  ]);

  return { success: true, message: "Resignation submitted" };
}

async function requestWithdrawal(data) {
  const { orgId, employeeId, exitId, reason } = data;
  const pool = await getTenantPoolByOrgId(orgId);

  const [result] = await pool.execute(Q.REQUEST_WITHDRAWAL, [
    reason, exitId, orgId, employeeId
  ]);

  if (result.affectedRows === 0) {
    throw new Error("Cannot withdraw — request not found or inactive");
  }

  return { success: true, message: "Withdrawal request sent" };
}
async function employeeProposeClearanceDates(data) {
  const { orgId, employeeId, exitId, ktProposedDate, assetsProposedDate } = data;
  const pool = await getTenantPoolByOrgId(orgId);

  const [result] = await pool.execute(Q.EMPLOYEE_PROPOSE_CLEARANCE_DATES, [
    ktProposedDate || null,
    assetsProposedDate || null,
    exitId,
    orgId,
    employeeId
  ]);

  if (result.affectedRows === 0) {
    throw new Error("Cannot submit — request not found, not resigned, or already proposed");
  }

  return { success: true, message: "Proposed dates submitted successfully" };
}
async function getMyTeamAllRequests(orgId, supervisorId) {
  const pool = await getTenantPoolByOrgId(orgId);
  const [rows] = await pool.execute(Q.GET_MY_TEAM_ALL_REQUESTS, [supervisorId, orgId]);
  return rows;
}

async function getAllOrgExitRequests(orgId) {
  const pool = await getTenantPoolByOrgId(orgId);
  const [rows] = await pool.execute(Q.GET_ALL_ORG_EXIT_REQUESTS, [orgId]);
  return rows;
}

async function getHrResignedClearance(orgId) {
  const pool = await getTenantPoolByOrgId(orgId);

  const [rows] = await pool.execute(`
    SELECT
      id,
      employee_id,
      reason,
      proposed_lwd,
      final_lwd,
      hr_action_at,

      kt_proposed_date,
      assets_proposed_date,
      proposed_dates_submitted_at,

      kt_planned_date,
      assets_return_planned_date,

      kt_completed,
      assets_returned,
      clearance_completed_at,

      hr_rating,
      hr_evaluation_comments

    FROM employee_exit_requests1
    WHERE org_id = ?
      AND final_outcome = 'RESIGNED'
    ORDER BY hr_action_at DESC
  `, [orgId]);

  return rows;
}async function getHrResignedClearance(orgId) {
  const pool = await getTenantPoolByOrgId(orgId);

  const [rows] = await pool.execute(`
    SELECT
      id,
      employee_id,
      reason,
      proposed_lwd,
      final_lwd,
      hr_action_at,

      kt_proposed_date,
      assets_proposed_date,
      proposed_dates_submitted_at,

      kt_planned_date,
      assets_return_planned_date,

      kt_completed,
      assets_returned,
      clearance_completed_at,

      hr_rating,
  hr_evaluation_comments,
  hr_comment,
  hr_final_lwd

    FROM employee_exit_requests1
    WHERE org_id = ?
      AND final_outcome = 'RESIGNED'
    ORDER BY hr_action_at DESC
  `, [orgId]);

  return rows;
}

async function hrUpdateClearanceStatus(data) {
  const { orgId, exitId, ktCompleted, assetsReturned } = data;
  const pool = await getTenantPoolByOrgId(orgId);

  const ktVal = ktCompleted ? 1 : 0;
  const assetsVal = assetsReturned ? 1 : 0;

  const [result] = await pool.execute(Q.HR_UPDATE_CLEARANCE_STATUS, [
    ktVal, assetsVal,
    ktVal, assetsVal,
    exitId, orgId
  ]);

  if (result.affectedRows === 0) {
    throw new Error("Cannot update clearance — request not found or not resigned");
  }

  return { success: true, message: "Clearance status updated" };
}

// Supervisor ────────────── normal action
async function supervisorNormalAction(data) {
  const { orgId, exitId, status, recommendedLwd, comment, actionBy } = data;
  const pool = await getTenantPoolByOrgId(orgId);

  if (status === "REJECTED") {
    await pool.execute(Q.SUPERVISOR_REJECT_FULL, [comment || null, actionBy, exitId, orgId]);
  } else if (status === "APPROVED") {
    await pool.execute(Q.SUPERVISOR_UPDATE_NORMAL, [
      status, recommendedLwd || null, comment || null, actionBy, status, exitId, orgId
    ]);
  } else {
    throw new Error("Invalid supervisor action status. Must be APPROVED or REJECTED");
  }
  return { success: true };
}

// Supervisor ────────────── withdrawal decision
async function supervisorWithdrawalAction(data) {
  const { orgId, exitId, status, comment } = data;
  const pool = await getTenantPoolByOrgId(orgId);

  await pool.execute(Q.SUPERVISOR_UPDATE_WITHDRAWAL, [
    status, comment || null, exitId, orgId
  ]);

  return { success: true };
}

// HR ────────────── normal action
async function hrNormalAction(data) {
  const { orgId, exitId, status, finalLwd, comment, actionBy } = data;
  const pool = await getTenantPoolByOrgId(orgId);

  await pool.execute(Q.HR_UPDATE_NORMAL, [
    status, finalLwd || null, comment || null, actionBy, exitId, orgId
  ]);

  return { success: true };
}

async function getMyActiveRequest(orgId, employeeId) {
  const pool = await getTenantPoolByOrgId(orgId);
  const [rows] = await pool.execute(`
    SELECT 
      *,
      leave_policy           -- ← make sure this is included
    FROM employee_exit_requests1
    WHERE org_id = ? AND employee_id = ?
    ORDER BY applied_at DESC
    LIMIT 1
  `, [orgId, employeeId]);
  return rows[0] || null;
}

// HR ────────────── final approve resignation
async function hrApproveResignation(data) {
  const { orgId, exitId, finalLwd, comment,leavePolicy, actionBy } = data;
  const pool = await getTenantPoolByOrgId(orgId);

  await pool.execute(Q.HR_FINAL_APPROVE_RESIGN, [
    finalLwd, comment || null,leavePolicy || null, actionBy, finalLwd, exitId, orgId
  ]);

  return { success: true, message: "Resignation approved" };
}

// HR ────────────── final approve withdrawal
async function hrApproveWithdrawal(data) {
  const { orgId, exitId, comment, actionBy } = data;
  const pool = await getTenantPoolByOrgId(orgId);

  await pool.execute(Q.HR_FINAL_APPROVE_WITHDRAW, [
    comment || null, actionBy, exitId, orgId
  ]);

  return { success: true, message: "Withdrawal approved" };
}

// List getters (used by frontend)
async function getSupervisorPending(orgId) {
  const pool = await getTenantPoolByOrgId(orgId);
  const [rows] = await pool.execute(Q.GET_SUPERVISOR_PENDING, [orgId]);
  return rows;
}

async function getSupervisorWithdrawPending(orgId) {
  const pool = await getTenantPoolByOrgId(orgId);
  const [rows] = await pool.execute(Q.GET_SUPERVISOR_WITHDRAW_PENDING, [orgId]);
  return rows;
}

async function getHrPending(orgId) {
  const pool = await getTenantPoolByOrgId(orgId);
  const [rows] = await pool.execute(Q.GET_HR_PENDING, [orgId]);
  return rows;
}

async function getHrWithdrawPending(orgId) {
  const pool = await getTenantPoolByOrgId(orgId);
  const [rows] = await pool.execute(Q.GET_HR_WITHDRAW_PENDING, [orgId]);
  return rows;
}

async function hrSetFinalPlannedDates(data) {
  const { orgId, exitId, ktPlannedDate, assetsPlannedDate } = data;
  const pool = await getTenantPoolByOrgId(orgId);
  await pool.execute(Q.HR_SET_FINAL_PLANNED_DATES, [
    ktPlannedDate || null,
    assetsPlannedDate || null,
    exitId,
    orgId
  ]);
  return { success: true };
}

async function hrSetFinalPlannedDates(data) {
  const { orgId, exitId, ktPlannedDate, assetsPlannedDate } = data;
  const pool = await getTenantPoolByOrgId(orgId);

  await pool.execute(Q.HR_SET_FINAL_PLANNED_DATES, [
    ktPlannedDate || null,
    assetsPlannedDate || null,
    exitId,
    orgId
  ]);

  return { success: true };
}
async function hrSetFinalPlannedDates(data) {
  const { orgId, exitId, ktPlannedDate, assetsPlannedDate } = data;
  const pool = await getTenantPoolByOrgId(orgId);

  await pool.execute(Q.HR_SET_FINAL_PLANNED_DATES, [
    ktPlannedDate || null,
    assetsPlannedDate || null,
    exitId,
    orgId
  ]);

  return { success: true };
}
async function getMyActiveRequest(orgId, employeeId) {
  const pool = await getTenantPoolByOrgId(orgId);
  const [rows] = await pool.execute(Q.GET_MY_ACTIVE_REQUEST, [orgId, employeeId]);
  return rows[0] || null;
}

async function saveHrFinalEvaluation(
  orgId,
  id,
  finalLwd,
  hrRating,
  hrEvaluationComments
) {
  const pool = await getTenantPoolByOrgId(orgId);

  await pool.execute(`
    UPDATE employee_exit_requests1
    SET
      final_lwd = ?,
      hr_rating = ?,
      hr_evaluation_comments = ?,
      updated_at = NOW()
    WHERE id = ?
      AND org_id = ?
  `, [
    finalLwd || null,
    hrRating || null,
    hrEvaluationComments || null,
    id,
    orgId
  ]);

  return { success: true };
}
module.exports = {
  applyResignation,
  requestWithdrawal,
  supervisorNormalAction,
  supervisorWithdrawalAction,
  hrNormalAction,
  hrApproveResignation,
  hrApproveWithdrawal,
  getSupervisorPending,
  getSupervisorWithdrawPending,
  getHrPending,
  getHrWithdrawPending,
  getMyActiveRequest,
  employeeProposeClearanceDates,
  getHrResignedClearance,
   hrSetFinalPlannedDates,
  hrSetFinalPlannedDates,
  hrUpdateClearanceStatus,
  getMyTeamAllRequests,
  getAllOrgExitRequests,
    saveHrFinalEvaluation,

};
