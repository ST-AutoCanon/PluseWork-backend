
const express = require("express");
const LeaveHandler = require("../handlers/leaveHandler"); // <--- use this name

const router = express.Router();


router.get("/types", LeaveHandler.getLeaveTypesHandler);

router.post("/employee/leave", LeaveHandler.submitLeaveRequestHandler);
router.get("/employee/leave/:employeeId", LeaveHandler.getLeaveRequestsHandler);

router.get("/admin/leave", LeaveHandler.getLeaveQueries);
router.put("/admin/leave/:leaveId", LeaveHandler.updateLeaveRequest);

router.put("/edit/:leaveId", LeaveHandler.editLeaveRequestHandler);
router.delete(
  "/cancel/:leaveId/:employeeId",
  LeaveHandler.cancelLeaveRequestHandler
);

router.get(
  "/team-lead/:teamLeadId",
  LeaveHandler.getLeaveRequestsForTeamLeadHandler
);

module.exports = router;