const express = require("express");
const {
  submitLeaveRequestHandler,
  getLeaveRequestsHandler,
  getLeaveQueries,
  updateLeaveRequest,
  editLeaveRequestHandler,
  cancelLeaveRequestHandler,
  getLeaveRequestsForTeamLeadHandler,
} = require("../handlers/leaveHandler");

const router = express.Router();

router.post("/employee/leave", submitLeaveRequestHandler);
router.get("/employee/leave/:employeeId", getLeaveRequestsHandler);
router.get("/admin/leave", getLeaveQueries);
router.put("/admin/leave/:leaveId", updateLeaveRequest);
router.put("/edit/:leaveId", editLeaveRequestHandler);
router.delete("/cancel/:leaveId/:employeeId", cancelLeaveRequestHandler);
router.get("/team-lead/:teamLeadId", getLeaveRequestsForTeamLeadHandler);

module.exports = router;
