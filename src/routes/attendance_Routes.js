const express = require("express");
const attendanceHandler = require("../handlers/attendanceHandler");

const router = express.Router();

// Get attendance for a specific employee
router.get(
  "/employee/:employeeId",
  (req, res, next) => {
    if (!req.params.employeeId) {
      return res.status(400).json({ success: false, message: "Employee ID is required" });
    }
    next();
  },
  attendanceHandler.getEmployeeAttendance
);

// Punch In
router.post(
  "/punch-in",
  (req, res, next) => {
    const { employeeId, device, location, punchMode } = req.body;
    if (!employeeId || !device || !location || !punchMode) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }
    next();
  },
  attendanceHandler.punchIn
);

// Punch Out
router.post(
  "/punch-out",
  (req, res, next) => {
    const { employeeId, device, location, punchMode } = req.body;
    if (!employeeId || !device || !location || !punchMode) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }
    next();
  },
  attendanceHandler.punchOut
);

// Today's attendance
router.get("/today", attendanceHandler.getTodayAttendance);

// Latest punch record for an employee
router.get("/employee/:employeeId/latest-punch", attendanceHandler.getLatestPunchRecord);

// Optional: individual latest punch in/out
router.get("/employee/:employeeId/latest-punch-in", attendanceHandler.getLatestPunchIn);
router.get("/employee/:employeeId/latest-punch-out", attendanceHandler.getLatestPunchOut);

module.exports = router;
