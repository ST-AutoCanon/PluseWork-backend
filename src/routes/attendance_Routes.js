// const express = require("express");
// const attendanceHandler = require("../handlers/attendanceHandler");
// const loginHoursConfigHandler = require("../handlers/loginHoursConfigHandler");

// const router = express.Router();

// // ==================== Attendance Core Routes ====================

// router.get(
//   "/employee/:employeeId",
//   (req, res, next) => {
//     if (!req.params.employeeId) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Employee ID is required" });
//     }
//     next();
//   },
//   attendanceHandler.getEmployeeAttendance,
// );

// // New: Office Location Validation
// router.post(
//   "/validate-office-location",
//   attendanceHandler.validateEmployeeOfficeLocation,
// );

// router.post(
//   "/punch-in",
//   (req, res, next) => {
//     const { employeeId, device, location, punchMode, latitude, longitude } =
//       req.body;
//     if (
//       !employeeId ||
//       !device ||
//       !location ||
//       !punchMode ||
//       latitude === undefined ||
//       longitude === undefined
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "All fields (including latitude & longitude) are required",
//       });
//     }
//     next();
//   },
//   attendanceHandler.punchIn,
// );

// router.post(
//   "/punch-out",
//   (req, res, next) => {
//     const { employeeId, device, location, punchMode, latitude, longitude } =
//       req.body;
//     if (
//       !employeeId ||
//       !device ||
//       !location ||
//       !punchMode ||
//       latitude === undefined ||
//       longitude === undefined
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "All fields (including latitude & longitude) are required",
//       });
//     }
//     next();
//   },
//   attendanceHandler.punchOut,
// );

// router.get("/today", attendanceHandler.getTodayAttendance);

// router.get(
//   "/employee/:employeeId/latest-punch",
//   attendanceHandler.getLatestPunchRecord,
// );

// router.get(
//   "/employee/:employeeId/latest-punch-in",
//   attendanceHandler.getLatestPunchIn,
// );

// router.get(
//   "/employee/:employeeId/latest-punch-out",
//   attendanceHandler.getLatestPunchOut,
// );

// router.get(
//   "/employee/:employeeId/late-login-dates",
//   attendanceHandler.getLateLoginDates,
// );

// // ==================== Late Streak Routes ====================

// router.get(
//   "/employee/:employeeId/late-streak-summary",
//   attendanceHandler.getLateLoginStreakSummary,
// );

// router.post(
//   "/employee/late-streak-notify",
//   attendanceHandler.sendLateLoginStreakNotifications,
// );

// router.post(
//   "/check-all-late-streaks",
//   attendanceHandler.checkAndNotifyAllLateStreaks,
// );

// // ==================== Login Hours Configuration ====================

// router.get(
//   "/login-hours-config",
//   loginHoursConfigHandler.getLoginHoursConfigHandler,
// );

// router.post(
//   "/login-hours-config",
//   loginHoursConfigHandler.upsertLoginHoursConfigHandler,
// );

// module.exports = router;

const express = require("express");
const attendanceHandler = require("../handlers/attendanceHandler");
const loginHoursConfigHandler = require("../handlers/loginHoursConfigHandler");

const router = express.Router();

// ==================== Attendance Core Routes ====================

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
  attendanceHandler.getEmployeeAttendance,
);

// New: Office Location Validation
router.post(
  "/validate-office-location",
  attendanceHandler.validateEmployeeOfficeLocation,
);

router.post(
  "/punch-in",
  (req, res, next) => {
    const { employeeId, device, location, punchMode, latitude, longitude } =
      req.body;
    if (
      !employeeId ||
      !device ||
      !location ||
      !punchMode ||
      latitude === undefined ||
      longitude === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields (including latitude & longitude) are required",
      });
    }
    next();
  },
  attendanceHandler.punchIn,
);

router.post(
  "/punch-out",
  (req, res, next) => {
    const { employeeId, device, location, punchMode, latitude, longitude } =
      req.body;
    if (
      !employeeId ||
      !device ||
      !location ||
      !punchMode ||
      latitude === undefined ||
      longitude === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields (including latitude & longitude) are required",
      });
    }
    next();
  },
  attendanceHandler.punchOut,
);

router.get("/today", attendanceHandler.getTodayAttendance);

router.get(
  "/employee/:employeeId/latest-punch",
  attendanceHandler.getLatestPunchRecord,
);

router.get(
  "/employee/:employeeId/punch-records",
  attendanceHandler.getPunchRecordsForDate,
);

router.get(
  "/employee/:employeeId/latest-punch-in",
  attendanceHandler.getLatestPunchIn,
);

router.get(
  "/employee/:employeeId/latest-punch-out",
  attendanceHandler.getLatestPunchOut,
);

router.get(
  "/employee/:employeeId/late-login-dates",
  attendanceHandler.getLateLoginDates,
);

// ==================== Late Streak Routes ====================

router.get(
  "/employee/:employeeId/late-streak-summary",
  attendanceHandler.getLateLoginStreakSummary,
);

router.post(
  "/employee/late-streak-notify",
  attendanceHandler.sendLateLoginStreakNotifications,
);

router.post(
  "/check-all-late-streaks",
  attendanceHandler.checkAndNotifyAllLateStreaks,
);

// ==================== Login Hours Configuration ====================

router.get(
  "/login-hours-config",
  loginHoursConfigHandler.getLoginHoursConfigHandler,
);

router.post(
  "/login-hours-config",
  loginHoursConfigHandler.upsertLoginHoursConfigHandler,
);

module.exports = router;
