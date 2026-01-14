const express = require("express");
const attendanceHandler = require("../handlers/attendanceHandler");

const router = express.Router();

router.get(
  "/employee/:employeeId",
  (req, res, next) => {
    if (!req.params.employeeId) {
      return res
        .status(400)
        .json({ success: false, message: "Employee ID is required" });
    }
    next();
  },
  attendanceHandler.getEmployeeAttendance
);

router.post(
  "/punch-in",
  (req, res, next) => {
    const { employeeId, device, location, punchMode } = req.body;
    if (!employeeId || !device || !location || !punchMode) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }
    next();
  },
  attendanceHandler.punchIn
);

router.post(
  "/punch-out",
  (req, res, next) => {
    const { employeeId, device, location, punchMode } = req.body;
    if (!employeeId || !device || !location || !punchMode) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }
    next();
  },
  attendanceHandler.punchOut
);

router.get("/today", attendanceHandler.getTodayAttendance);

router.get(
  "/employee/:employeeId/latest-punch",
  attendanceHandler.getLatestPunchRecord
);

router.get(
  "/employee/:employeeId/latest-punch-in",
  attendanceHandler.getLatestPunchIn
);
router.get(
  "/employee/:employeeId/latest-punch-out",
  attendanceHandler.getLatestPunchOut
);

module.exports = router;
