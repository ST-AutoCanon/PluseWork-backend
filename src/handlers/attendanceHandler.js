// const attendanceService = require("../services/attendanceService");
// const db = require("../config");

// const extractOrgId = (req) =>
//   req.headers["x-org-id"] ||
//   req.query.orgId ||
//   (req.user && (req.user.orgId || req.user.Org_id || req.user.org_id)) ||
//   "1";

// const attendanceHandler = {
//   getEmployeeAttendance: async (req, res) => {
//     try {
//       const { employeeId } = req.params;
//       const orgId = extractOrgId(req);

//       if (!employeeId) {
//         return res
//           .status(400)
//           .json({ success: false, message: "Employee ID is required" });
//       }

//       const records = await attendanceService.getEmployeeAttendance(
//         employeeId,
//         orgId,
//       );
//       res.status(200).json({ success: true, data: records });
//     } catch (error) {
//       console.error("[GET_ATTENDANCE] Error:", error.message);
//       res.status(500).json({ success: false, message: error.message });
//     }
//   },

//   validateEmployeeOfficeLocation: async (req, res) => {
//     try {
//       const { employeeId, latitude, longitude, device } = req.body;
//       const orgId = extractOrgId(req);

//       if (!employeeId) {
//         return res
//           .status(400)
//           .json({ success: false, message: "Employee ID is required" });
//       }

//       const result = await attendanceService.validateEmployeeOfficeLocation(
//         employeeId,
//         latitude,
//         longitude,
//         orgId,
//         device,
//       );

//       return res.status(200).json({
//         success: true,
//         ...result,
//       });
//     } catch (error) {
//       console.error("[VALIDATE_OFFICE_LOCATION] Error:", error.message);
//       return res.status(500).json({ success: false, message: error.message });
//     }
//   },

//   punchIn: async (req, res) => {
//     try {
//       const { employeeId, device, location, punchMode, latitude, longitude } =
//         req.body;

//       const orgId = extractOrgId(req);

//       if (
//         !employeeId ||
//         !device ||
//         !location ||
//         !punchMode ||
//         latitude === undefined ||
//         longitude === undefined
//       ) {
//         return res.status(400).json({
//           success: false,
//           message:
//             "employeeId, device, location, punchMode, latitude and longitude are required",
//         });
//       }

//       // 1) Check last punch status
//       const lastPunchStatus = await attendanceService.getLastPunchStatus(
//         employeeId,
//         orgId,
//       );

//       if (lastPunchStatus === "Punch In") {
//         return res
//           .status(400)
//           .json({ success: false, message: "Already punched in." });
//       }

//       // 2) Validate with device info (Mobile only for assigned employees)
//       const officeValidation =
//         await attendanceService.validateEmployeeOfficeLocation(
//           employeeId,
//           Number(latitude),
//           Number(longitude),
//           orgId,
//           device,
//         );

//       if (!officeValidation.allowed) {
//         return res.status(403).json({
//           success: false,
//           message: officeValidation.message,
//         });
//       }

//       // 3) Late login calculation (delegated to service where possible)
//       const result = await attendanceService.recordAndNotifyLateLogin({
//         employeeId,
//         orgId,
//         device,
//         location,
//         punchMode,
//       });

//       return res.status(201).json({
//         success: true,
//         message: result.lateLogin
//           ? "Punch In successful - Late login recorded"
//           : "Punch In successful",
//         punchId: result.insertId,
//         lateLogin: result.lateLogin,
//         streakBreached: result.streakBreached,
//         office: officeValidation.office || null,
//         distance: officeValidation.distance ?? null,
//       });
//     } catch (error) {
//       console.error("[PUNCH_IN] Error:", error.message);
//       return res.status(500).json({ success: false, message: error.message });
//     }
//   },

//   punchOut: async (req, res) => {
//     try {
//       const { employeeId, device, location, punchMode, latitude, longitude } =
//         req.body;

//       const orgId = extractOrgId(req);

//       if (
//         !employeeId ||
//         !device ||
//         !location ||
//         !punchMode ||
//         latitude === undefined ||
//         longitude === undefined
//       ) {
//         return res.status(400).json({
//           success: false,
//           message: "All fields are required",
//         });
//       }

//       const lastPunchStatus = await attendanceService.getLastPunchStatus(
//         employeeId,
//         orgId,
//       );

//       if (lastPunchStatus !== "Punch In") {
//         return res.status(400).json({
//           success: false,
//           message: "Cannot punch out without punching in first.",
//         });
//       }

//       const officeValidation =
//         await attendanceService.validateEmployeeOfficeLocation(
//           employeeId,
//           Number(latitude),
//           Number(longitude),
//           orgId,
//           device,
//         );

//       if (!officeValidation.allowed) {
//         return res.status(403).json({
//           success: false,
//           message: officeValidation.message,
//         });
//       }

//       const updatedRows = await attendanceService.updatePunchOut(
//         employeeId,
//         device,
//         location,
//         punchMode,
//         orgId,
//       );

//       if (updatedRows > 0) {
//         return res.status(200).json({
//           success: true,
//           message: "Punch Out successful",
//           office: officeValidation.office || null,
//           distance: officeValidation.distance ?? null,
//         });
//       }

//       return res.status(400).json({
//         success: false,
//         message: "Punch Out failed. No active Punch In record found.",
//       });
//     } catch (error) {
//       console.error("[PUNCH_OUT] Error:", error.message);
//       return res.status(500).json({ success: false, message: error.message });
//     }
//   },

//   getTodayAttendance: async (req, res) => {
//     try {
//       const orgId = extractOrgId(req);
//       if (!orgId) {
//         return res
//           .status(400)
//           .json({ success: false, message: "orgId is required" });
//       }

//       const attendanceData = await attendanceService.getTodayAttendance(orgId);
//       res.status(200).json({ success: true, data: attendanceData });
//     } catch (error) {
//       console.error("[TODAY_ATTENDANCE] Error:", error.message);
//       res.status(500).json({ success: false, message: error.message });
//     }
//   },

//   getLatestPunchIn: async (req, res) => {
//     try {
//       const { employeeId } = req.params;
//       const orgId = extractOrgId(req);

//       if (!employeeId) {
//         return res
//           .status(400)
//           .json({ success: false, message: "Employee ID is required" });
//       }
//       if (!orgId) {
//         return res
//           .status(400)
//           .json({ success: false, message: "orgId is required" });
//       }

//       const record = await attendanceService.getLatestPunchIn(
//         employeeId,
//         orgId,
//       );

//       if (record) {
//         res.status(200).json({ success: true, data: record });
//       } else {
//         res
//           .status(404)
//           .json({ success: false, message: "No Punch In record found." });
//       }
//     } catch (error) {
//       res.status(500).json({ success: false, message: error.message });
//     }
//   },

//   getLatestPunchOut: async (req, res) => {
//     try {
//       const { employeeId } = req.params;
//       const orgId = extractOrgId(req);

//       if (!employeeId) {
//         return res
//           .status(400)
//           .json({ success: false, message: "Employee ID is required" });
//       }
//       if (!orgId) {
//         return res
//           .status(400)
//           .json({ success: false, message: "orgId is required" });
//       }

//       const record = await attendanceService.getLatestPunchOut(
//         employeeId,
//         orgId,
//       );

//       if (record) {
//         res.status(200).json({ success: true, data: record });
//       } else {
//         res
//           .status(404)
//           .json({ success: false, message: "No Punch Out record found." });
//       }
//     } catch (error) {
//       res.status(500).json({ success: false, message: error.message });
//     }
//   },

//   getLatestPunchRecord: async (req, res) => {
//     try {
//       const { employeeId } = req.params;
//       let orgId = extractOrgId(req);

//       if (!employeeId) {
//         return res
//           .status(400)
//           .json({ success: false, message: "Employee ID is required" });
//       }

//       if (!orgId && employeeId) {
//         const prefix = employeeId.split("-")[0];
//         if (prefix) {
//           const [rows] = await db.query(
//             "SELECT id FROM organizations WHERE UPPER(employee_prefix) = ?",
//             [prefix.toUpperCase()],
//           );
//           if (rows.length > 0) {
//             orgId = rows[0].id;
//           }
//         }
//       }

//       if (!orgId) {
//         return res
//           .status(400)
//           .json({ success: false, message: "orgId is required" });
//       }

//       const latestPunch = await attendanceService.fetchLatestPunchRecord(
//         employeeId,
//         orgId,
//       );

//       if (!latestPunch) {
//         return res.status(200).json({
//           success: true,
//           message: "No punch record found.",
//           data: null,
//         });
//       }

//       res.status(200).json({ success: true, data: latestPunch });
//     } catch (error) {
//       console.error("Error fetching latest punch record:", error);
//       res.status(500).json({ success: false, message: "Server error" });
//     }
//   },

//   getLateLoginDates: async (req, res) => {
//     try {
//       const { employeeId } = req.params;
//       const orgId = extractOrgId(req);

//       if (!employeeId) {
//         return res
//           .status(400)
//           .json({ success: false, message: "Employee ID is required" });
//       }

//       if (!orgId) {
//         return res
//           .status(400)
//           .json({ success: false, message: "orgId is required" });
//       }

//       const lateDates = await attendanceService.getLateLoginDates(
//         employeeId,
//         orgId,
//         90,
//       );

//       res.status(200).json({
//         success: true,
//         data: { lateDates: lateDates || [] },
//       });
//     } catch (error) {
//       console.error("[GET_LATE_LOGIN_DATES] Error:", error.message);
//       res.status(500).json({ success: false, message: error.message });
//     }
//   },

//   // Late Streak & Config Handlers
//   getLateLoginStreakSummary: async (req, res) => {
//     try {
//       const { employeeId } = req.params;
//       const orgId = extractOrgId(req);

//       if (!employeeId) {
//         return res
//           .status(400)
//           .json({ success: false, message: "Employee ID is required" });
//       }

//       const summary = await attendanceService.getLateLoginStreakSummary(
//         employeeId,
//         orgId,
//       );

//       return res.status(200).json({ success: true, data: summary });
//     } catch (error) {
//       console.error("[GET_LATE_STREAK_SUMMARY] Error:", error.message);
//       return res.status(500).json({ success: false, message: error.message });
//     }
//   },

//   sendLateLoginStreakNotifications: async (req, res) => {
//     try {
//       const { employeeId } = req.body;
//       const orgId = extractOrgId(req);

//       if (!employeeId) {
//         return res
//           .status(400)
//           .json({ success: false, message: "Employee ID is required" });
//       }

//       const result = await attendanceService.sendLateLoginStreakNotifications({
//         employeeId,
//         orgId,
//       });

//       return res.status(200).json({ success: true, data: result });
//     } catch (error) {
//       console.error("[SEND_LATE_STREAK_NOTIFICATIONS] Error:", error.message);
//       return res.status(500).json({ success: false, message: error.message });
//     }
//   },

//   checkAndNotifyAllLateStreaks: async (req, res) => {
//     try {
//       const orgId = extractOrgId(req);

//       if (!orgId) {
//         return res
//           .status(400)
//           .json({ success: false, message: "orgId is required" });
//       }

//       await attendanceService.checkAndNotifyAllLateStreaks(orgId);

//       return res.status(200).json({
//         success: true,
//         message: "Late streak check completed for the organization",
//       });
//     } catch (error) {
//       console.error("[CHECK_ALL_LATE_STREAKS] Error:", error.message);
//       return res.status(500).json({ success: false, message: error.message });
//     }
//   },

//   getLoginHoursConfig: async (req, res) => {
//     try {
//       const orgId = extractOrgId(req);

//       if (!orgId) {
//         return res
//           .status(400)
//           .json({ success: false, message: "orgId is required" });
//       }

//       const config = await attendanceService.getLoginHoursConfig(orgId);
//       return res.status(200).json({ success: true, data: config });
//     } catch (error) {
//       console.error("[GET_LOGIN_HOURS_CONFIG] Error:", error.message);
//       return res.status(500).json({ success: false, message: error.message });
//     }
//   },

//   upsertLoginHoursConfig: async (req, res) => {
//     try {
//       const orgId = extractOrgId(req);
//       const config = req.body;

//       if (!orgId) {
//         return res
//           .status(400)
//           .json({ success: false, message: "orgId is required" });
//       }

//       const result = await attendanceService.upsertLoginHoursConfig(
//         orgId,
//         config,
//       );

//       return res.status(200).json({
//         success: true,
//         message: "Login hours config updated successfully",
//         data: result,
//       });
//     } catch (error) {
//       console.error("[UPSERT_LOGIN_HOURS_CONFIG] Error:", error.message);
//       return res.status(500).json({ success: false, message: error.message });
//     }
//   },
// };

// module.exports = attendanceHandler;

const attendanceService = require("../services/attendanceService");
const db = require("../config");

const extractOrgId = (req) =>
  req.headers["x-org-id"] ||
  req.query.orgId ||
  (req.user && (req.user.orgId || req.user.Org_id || req.user.org_id)) ||
  "1";

const attendanceHandler = {
  getEmployeeAttendance: async (req, res) => {
    try {
      const { employeeId } = req.params;
      const orgId = extractOrgId(req);

      if (!employeeId) {
        return res
          .status(400)
          .json({ success: false, message: "Employee ID is required" });
      }

      const records = await attendanceService.getEmployeeAttendance(
        employeeId,
        orgId,
      );
      res.status(200).json({ success: true, data: records });
    } catch (error) {
      console.error("[GET_ATTENDANCE] Error:", error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  validateEmployeeOfficeLocation: async (req, res) => {
    try {
      const { employeeId, latitude, longitude, device } = req.body;
      const orgId = extractOrgId(req);

      if (!employeeId) {
        return res
          .status(400)
          .json({ success: false, message: "Employee ID is required" });
      }

      const result = await attendanceService.validateEmployeeOfficeLocation(
        employeeId,
        latitude,
        longitude,
        orgId,
        device,
      );

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error("[VALIDATE_OFFICE_LOCATION] Error:", error.message);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  punchIn: async (req, res) => {
    try {
      const { employeeId, device, location, punchMode, latitude, longitude } =
        req.body;

      const orgId = extractOrgId(req);

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
          message:
            "employeeId, device, location, punchMode, latitude and longitude are required",
        });
      }

      // 1) Check last punch status
      const lastPunchStatus = await attendanceService.getLastPunchStatus(
        employeeId,
        orgId,
      );

      if (lastPunchStatus === "Punch In") {
        return res
          .status(400)
          .json({ success: false, message: "Already punched in." });
      }

      // 2) Validate with device info (Mobile only for assigned employees)
      const officeValidation =
        await attendanceService.validateEmployeeOfficeLocation(
          employeeId,
          Number(latitude),
          Number(longitude),
          orgId,
          device,
        );

      if (!officeValidation.allowed) {
        return res.status(403).json({
          success: false,
          message: officeValidation.message,
        });
      }

      // 3) Late login calculation (delegated to service where possible)
      const result = await attendanceService.recordAndNotifyLateLogin({
        employeeId,
        orgId,
        device,
        location,
        punchMode,
      });

      return res.status(201).json({
        success: true,
        message: result.lateLogin
          ? "Punch In successful - Late login recorded"
          : "Punch In successful",
        punchId: result.insertId,
        lateLogin: result.lateLogin,
        streakBreached: result.streakBreached,
        office: officeValidation.office || null,
        distance: officeValidation.distance ?? null,
      });
    } catch (error) {
      console.error("[PUNCH_IN] Error:", error.message);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  punchOut: async (req, res) => {
    try {
      const { employeeId, device, location, punchMode, latitude, longitude } =
        req.body;

      const orgId = extractOrgId(req);

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
          message: "All fields are required",
        });
      }

      const lastPunchStatus = await attendanceService.getLastPunchStatus(
        employeeId,
        orgId,
      );

      if (lastPunchStatus !== "Punch In") {
        return res.status(400).json({
          success: false,
          message: "Cannot punch out without punching in first.",
        });
      }

      const officeValidation =
        await attendanceService.validateEmployeeOfficeLocation(
          employeeId,
          Number(latitude),
          Number(longitude),
          orgId,
          device,
        );

      if (!officeValidation.allowed) {
        return res.status(403).json({
          success: false,
          message: officeValidation.message,
        });
      }

      const updatedRows = await attendanceService.updatePunchOut(
        employeeId,
        device,
        location,
        punchMode,
        orgId,
      );

      if (updatedRows > 0) {
        return res.status(200).json({
          success: true,
          message: "Punch Out successful",
          office: officeValidation.office || null,
          distance: officeValidation.distance ?? null,
        });
      }

      return res.status(400).json({
        success: false,
        message: "Punch Out failed. No active Punch In record found.",
      });
    } catch (error) {
      console.error("[PUNCH_OUT] Error:", error.message);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  getTodayAttendance: async (req, res) => {
    try {
      const orgId = extractOrgId(req);
      if (!orgId) {
        return res
          .status(400)
          .json({ success: false, message: "orgId is required" });
      }

      const attendanceData = await attendanceService.getTodayAttendance(orgId);
      res.status(200).json({ success: true, data: attendanceData });
    } catch (error) {
      console.error("[TODAY_ATTENDANCE] Error:", error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getLatestPunchIn: async (req, res) => {
    try {
      const { employeeId } = req.params;
      const orgId = extractOrgId(req);

      if (!employeeId) {
        return res
          .status(400)
          .json({ success: false, message: "Employee ID is required" });
      }
      if (!orgId) {
        return res
          .status(400)
          .json({ success: false, message: "orgId is required" });
      }

      const record = await attendanceService.getLatestPunchIn(
        employeeId,
        orgId,
      );

      if (record) {
        res.status(200).json({ success: true, data: record });
      } else {
        res
          .status(404)
          .json({ success: false, message: "No Punch In record found." });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getLatestPunchOut: async (req, res) => {
    try {
      const { employeeId } = req.params;
      const orgId = extractOrgId(req);

      if (!employeeId) {
        return res
          .status(400)
          .json({ success: false, message: "Employee ID is required" });
      }
      if (!orgId) {
        return res
          .status(400)
          .json({ success: false, message: "orgId is required" });
      }

      const record = await attendanceService.getLatestPunchOut(
        employeeId,
        orgId,
      );

      if (record) {
        res.status(200).json({ success: true, data: record });
      } else {
        res
          .status(404)
          .json({ success: false, message: "No Punch Out record found." });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getLatestPunchRecord: async (req, res) => {
    try {
      const { employeeId } = req.params;
      let orgId = extractOrgId(req);

      if (!employeeId) {
        return res
          .status(400)
          .json({ success: false, message: "Employee ID is required" });
      }

      if (!orgId && employeeId) {
        const prefix = employeeId.split("-")[0];
        if (prefix) {
          const [rows] = await db.query(
            "SELECT id FROM organizations WHERE UPPER(employee_prefix) = ?",
            [prefix.toUpperCase()],
          );
          if (rows.length > 0) {
            orgId = rows[0].id;
          }
        }
      }

      if (!orgId) {
        return res
          .status(400)
          .json({ success: false, message: "orgId is required" });
      }

      const latestPunch = await attendanceService.fetchLatestPunchRecord(
        employeeId,
        orgId,
      );

      if (!latestPunch) {
        return res.status(200).json({
          success: true,
          message: "No punch record found.",
          data: null,
        });
      }

      res.status(200).json({ success: true, data: latestPunch });
    } catch (error) {
      console.error("Error fetching latest punch record:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  getPunchRecordsForDate: async (req, res) => {
    try {
      const { employeeId } = req.params;
      const orgId = extractOrgId(req);
      const dateKey = String(req.query.date || "");

      if (!employeeId) {
        return res
          .status(400)
          .json({ success: false, message: "Employee ID is required" });
      }

      if (!orgId) {
        return res
          .status(400)
          .json({ success: false, message: "orgId is required" });
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return res.status(400).json({
          success: false,
          message: "date must be in YYYY-MM-DD format",
        });
      }

      const records = await attendanceService.getPunchRecordsForDate(
        employeeId,
        orgId,
        dateKey,
      );

      return res.status(200).json({
        success: true,
        data: {
          date: dateKey,
          records,
          hasPunchIn: records.some((record) => record.punchin_time),
          hasPunchOut: records.some((record) => record.punchout_time),
          hasOpenPunch: records.some((record) => {
            const punchMode = String(record?.punchmode ?? "")
              .trim()
              .toLowerCase();
            const punchOutDevice = String(record?.punchout_device ?? "")
              .trim()
              .toLowerCase();
            const punchOutLocation = String(record?.punchout_location ?? "")
              .trim()
              .toLowerCase();

            return (
              record.punch_status === "Punch In" ||
              (!!record.punchin_time &&
                (!record.punchout_time ||
                  punchMode === "automatic" ||
                  punchOutDevice === "automatic" ||
                  punchOutLocation === "automatic"))
            );
          }),
        },
      });
    } catch (error) {
      console.error("[GET_PUNCH_RECORDS_FOR_DATE] Error:", error.message);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  getLateLoginDates: async (req, res) => {
    try {
      const { employeeId } = req.params;
      const orgId = extractOrgId(req);

      if (!employeeId) {
        return res
          .status(400)
          .json({ success: false, message: "Employee ID is required" });
      }

      if (!orgId) {
        return res
          .status(400)
          .json({ success: false, message: "orgId is required" });
      }

      const lateDates = await attendanceService.getLateLoginDates(
        employeeId,
        orgId,
        90,
      );

      res.status(200).json({
        success: true,
        data: { lateDates: lateDates || [] },
      });
    } catch (error) {
      console.error("[GET_LATE_LOGIN_DATES] Error:", error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Late Streak & Config Handlers
  getLateLoginStreakSummary: async (req, res) => {
    try {
      const { employeeId } = req.params;
      const orgId = extractOrgId(req);

      if (!employeeId) {
        return res
          .status(400)
          .json({ success: false, message: "Employee ID is required" });
      }

      const summary = await attendanceService.getLateLoginStreakSummary(
        employeeId,
        orgId,
      );

      return res.status(200).json({ success: true, data: summary });
    } catch (error) {
      console.error("[GET_LATE_STREAK_SUMMARY] Error:", error.message);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  sendLateLoginStreakNotifications: async (req, res) => {
    try {
      const { employeeId } = req.body;
      const orgId = extractOrgId(req);

      if (!employeeId) {
        return res
          .status(400)
          .json({ success: false, message: "Employee ID is required" });
      }

      const result = await attendanceService.sendLateLoginStreakNotifications({
        employeeId,
        orgId,
      });

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      console.error("[SEND_LATE_STREAK_NOTIFICATIONS] Error:", error.message);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  checkAndNotifyAllLateStreaks: async (req, res) => {
    try {
      const orgId = extractOrgId(req);

      if (!orgId) {
        return res
          .status(400)
          .json({ success: false, message: "orgId is required" });
      }

      await attendanceService.checkAndNotifyAllLateStreaks(orgId);

      return res.status(200).json({
        success: true,
        message: "Late streak check completed for the organization",
      });
    } catch (error) {
      console.error("[CHECK_ALL_LATE_STREAKS] Error:", error.message);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  getLoginHoursConfig: async (req, res) => {
    try {
      const orgId = extractOrgId(req);

      if (!orgId) {
        return res
          .status(400)
          .json({ success: false, message: "orgId is required" });
      }

      const config = await attendanceService.getLoginHoursConfig(orgId);
      return res.status(200).json({ success: true, data: config });
    } catch (error) {
      console.error("[GET_LOGIN_HOURS_CONFIG] Error:", error.message);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  upsertLoginHoursConfig: async (req, res) => {
    try {
      const orgId = extractOrgId(req);
      const config = req.body;

      if (!orgId) {
        return res
          .status(400)
          .json({ success: false, message: "orgId is required" });
      }

      const result = await attendanceService.upsertLoginHoursConfig(
        orgId,
        config,
      );

      return res.status(200).json({
        success: true,
        message: "Login hours config updated successfully",
        data: result,
      });
    } catch (error) {
      console.error("[UPSERT_LOGIN_HOURS_CONFIG] Error:", error.message);
      return res.status(500).json({ success: false, message: error.message });
    }
  },
};

module.exports = attendanceHandler;
