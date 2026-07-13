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

//   punchIn: async (req, res) => {
//     try {
//       const { employeeId, device, location, punchMode } = req.body;
//       const orgId = extractOrgId(req);

//       if (!employeeId || !device || !location || !punchMode) {
//         return res
//           .status(400)
//           .json({ success: false, message: "All fields are required" });
//       }

//       const lastPunchStatus = await attendanceService.getLastPunchStatus(
//         employeeId,
//         orgId,
//       );
//       if (lastPunchStatus === "Punch In") {
//         return res
//           .status(400)
//           .json({ success: false, message: "Already punched in." });
//       }

//       let lateLogin = false;
//       try {
//         const loginConfig = await attendanceService.getLoginHoursConfig(orgId);
//         if (loginConfig?.late_login_enabled) {
//           const punchInStart =
//             loginConfig.punch_in_start ?? loginConfig.punchInStart;
//           const bufferMinutes = Number(
//             loginConfig.buffer_minutes ?? loginConfig.bufferMinutes ?? 10,
//           );
//           if (punchInStart) {
//             const timeMatch = punchInStart.match(
//               /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/,
//             );
//             if (timeMatch) {
//               const now = new Date();
//               const hour = Number(timeMatch[1]);
//               const minute = Number(timeMatch[2]);
//               const threshold = new Date(now);
//               threshold.setHours(hour, minute, 0, 0);
//               threshold.setMinutes(threshold.getMinutes() + bufferMinutes);
//               if (now > threshold) {
//                 lateLogin = true;
//               }
//             }
//           }
//         }
//       } catch (err) {
//         console.warn("Unable to compute late login status:", err);
//       }

//       const punchId = await attendanceService.addPunchIn(
//         employeeId,
//         device,
//         location,
//         punchMode,
//         orgId,
//         lateLogin,
//       );
//       res.status(201).json({
//         success: true,
//         message: lateLogin
//           ? "Punch In successful - Late login recorded"
//           : "Punch In successful",
//         punchId,
//         lateLogin,
//       });
//     } catch (error) {
//       console.error("[PUNCH_IN] Error:", error.message);
//       res.status(500).json({ success: false, message: error.message });
//     }
//   },

//   punchOut: async (req, res) => {
//     try {
//       const { employeeId, device, location, punchMode } = req.body;
//       const orgId = extractOrgId(req);

//       if (!employeeId || !device || !location || !punchMode) {
//         return res
//           .status(400)
//           .json({ success: false, message: "All fields are required" });
//       }
//       if (!orgId) {
//         return res
//           .status(400)
//           .json({ success: false, message: "orgId is required" });
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

//       const updatedRows = await attendanceService.updatePunchOut(
//         employeeId,
//         device,
//         location,
//         punchMode,
//         orgId,
//       );
//       if (updatedRows > 0) {
//         res
//           .status(200)
//           .json({ success: true, message: "Punch Out successful" });
//       } else {
//         res.status(400).json({
//           success: false,
//           message: "Punch Out failed. No active Punch In record found.",
//         });
//       }
//     } catch (error) {
//       console.error("[PUNCH_OUT] Error:", error.message);
//       res.status(500).json({ success: false, message: error.message });
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

//       // Query last 90 days of late login records
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

  punchIn: async (req, res) => {
    try {
      const {
        employeeId,
        device,
        location,
        punchMode,
        latitude,
        longitude,
      } = req.body;

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

      // 2) Validate employee office location access using lat/lng
      const officeValidation =
        await attendanceService.validateEmployeeOfficeLocation(
          employeeId,
          Number(latitude),
          Number(longitude),
          orgId,
        );

      if (!officeValidation.allowed) {
        return res.status(403).json({
          success: false,
          message:
            officeValidation.message ||
            "You are not within the allowed office location radius",
        });
      }

      // 3) Late login calculation
      let lateLogin = false;
      try {
        const loginConfig = await attendanceService.getLoginHoursConfig(orgId);

        if (loginConfig?.late_login_enabled) {
          const punchInStart =
            loginConfig.punch_in_start ?? loginConfig.punchInStart;
          const bufferMinutes = Number(
            loginConfig.buffer_minutes ?? loginConfig.bufferMinutes ?? 10,
          );

          if (punchInStart) {
            const timeMatch = punchInStart.match(
              /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/,
            );

            if (timeMatch) {
              const now = new Date();
              const hour = Number(timeMatch[1]);
              const minute = Number(timeMatch[2]);

              const threshold = new Date(now);
              threshold.setHours(hour, minute, 0, 0);
              threshold.setMinutes(threshold.getMinutes() + bufferMinutes);

              if (now > threshold) {
                lateLogin = true;
              }
            }
          }
        }
      } catch (err) {
        console.warn("Unable to compute late login status:", err);
      }

      // 4) Store attendance WITHOUT latitude/longitude
      const punchId = await attendanceService.addPunchIn(
        employeeId,
        device,
        location,
        punchMode,
        orgId,
        lateLogin,
      );

      return res.status(201).json({
        success: true,
        message: lateLogin
          ? "Punch In successful - Late login recorded"
          : "Punch In successful",
        punchId,
        lateLogin,
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
      const {
        employeeId,
        device,
        location,
        punchMode,
        latitude,
        longitude,
      } = req.body;

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

      if (!orgId) {
        return res
          .status(400)
          .json({ success: false, message: "orgId is required" });
      }

      // 1) Check last punch status
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

      // 2) Validate office location before punch-out also
      const officeValidation =
        await attendanceService.validateEmployeeOfficeLocation(
          employeeId,
          Number(latitude),
          Number(longitude),
          orgId,
        );

      if (!officeValidation.allowed) {
        return res.status(403).json({
          success: false,
          message:
            officeValidation.message ||
            "You are not within the allowed office location radius",
        });
      }

      // 3) Update attendance WITHOUT storing lat/lng
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
};

module.exports = attendanceHandler;