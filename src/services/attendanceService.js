// const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
// const attendanceQueries = require("../constants/attendanceQueries");

// const attendanceService = {
//   getEmployeeAttendance: async (employeeId, orgId) => {
//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);
//       const [rows] = await tenantPool.execute(
//         attendanceQueries.GET_EMPLOYEE_ATTENDANCE,
//         [employeeId],
//       );
//       return rows;
//     } catch (error) {
//       console.error("Error in getEmployeeAttendance:", error);
//       throw error;
//     }
//   },

//   hasColumn: async (orgId, tableName, columnName) => {
//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);
//       const [rows] = await tenantPool.execute(
//         `SELECT 1
//          FROM information_schema.COLUMNS
//          WHERE TABLE_SCHEMA = DATABASE()
//            AND TABLE_NAME = ?
//            AND COLUMN_NAME = ?
//          LIMIT 1`,
//         [tableName, columnName],
//       );
//       return Array.isArray(rows) && rows.length > 0;
//     } catch (error) {
//       console.error("Error in hasColumn:", error);
//       throw error;
//     }
//   },

//   addPunchIn: async (
//     employeeId,
//     device,
//     location,
//     punchMode,
//     orgId,
//     lateLogin = false,
//   ) => {
//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);
//       const lateLoginColumnExists = await attendanceService.hasColumn(
//         orgId,
//         "emp_attendence",
//         "late_login",
//       );

//       let query = attendanceQueries.ADD_PUNCH_IN;
//       let params = [employeeId, device, location, punchMode];

//       if (lateLoginColumnExists) {
//         query = `INSERT INTO emp_attendence (
//           employee_id,
//           punch_status,
//           punchin_time,
//           punchin_device,
//           punchin_location,
//           punchmode,
//           late_login
//         ) VALUES (?, 'Punch In', NOW(), ?, ?, ?, ?)`;
//         params = [employeeId, device, location, punchMode, lateLogin ? 1 : 0];
//       }

//       const [result] = await tenantPool.execute(query, params);
//       return result.insertId;
//     } catch (error) {
//       console.error("Error in addPunchIn:", error);
//       throw error;
//     }
//   },

//   updatePunchOut: async (employeeId, device, location, punchMode, orgId) => {
//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);
//       const [result] = await tenantPool.execute(
//         attendanceQueries.UPDATE_PUNCH_OUT,
//         [device, location, punchMode, employeeId],
//       );
//       return result.affectedRows;
//     } catch (error) {
//       console.error("Error in updatePunchOut:", error);
//       throw error;
//     }
//   },

//   getLastPunchStatus: async (employeeId, orgId) => {
//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);
//       const [rows] = await tenantPool.execute(
//         attendanceQueries.GET_LAST_PUNCH_STATUS,
//         [employeeId],
//       );
//       return rows.length ? rows[0].punch_status : null;
//     } catch (error) {
//       console.error("Error in getLastPunchStatus:", error);
//       throw error;
//     }
//   },

//   getLoginHoursConfig: async (orgId) => {
//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);

//       // Always fetch the latest record for this organization
//       const [rows] = await tenantPool.execute(
//         `SELECT *
//          FROM login_hours_config
//          WHERE org_id = ?
//          ORDER BY id DESC
//          LIMIT 1`,
//         [orgId],
//       );

//       if (!rows || rows.length === 0) return null;

//       const row = rows[0];

//       // Parse JSON column if present
//       try {
//         if (row.action_roles && typeof row.action_roles === "string") {
//           row.action_roles = JSON.parse(row.action_roles);
//         }
//       } catch (e) {
//         // ignore parse errors and leave raw value as-is
//       }

//       return row;
//     } catch (error) {
//       console.error("Error in getLoginHoursConfig:", error);
//       throw error;
//     }
//   },

//   upsertLoginHoursConfig: async (orgId, config) => {
//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);

//       const punchInStart =
//         config?.punch_in_start ?? config?.punchInStart ?? null;
//       const punchOutStart =
//         config?.punch_out_start ?? config?.punchOutStart ?? null;
//       const bufferMinutes = Number(
//         config?.attendance_punch_buffer_minutes ??
//           config?.buffer_minutes ??
//           config?.bufferMinutes ??
//           10,
//       );
//       const lateLoginEnabled =
//         config?.late_login_enabled ?? config?.lateLoginEnabled ?? 1;
//       const lateStreakDays =
//         Number(config?.late_login_streak_days ?? config?.lateStreakDays ?? 3) ||
//         3;
//       const autoMarkLate = config?.auto_mark_late ?? config?.autoMarkLate ?? 1;
//       const escalationMode =
//         config?.late_escalation_mode ?? config?.escalationMode ?? "mail_notify";
//       const actionRoles =
//         config?.late_action_roles ??
//         config?.action_roles ??
//         config?.actionRoles ??
//         null;
//       const requiredDailyMinutes = Number(
//         config?.required_daily_minutes ?? config?.requiredDailyMinutes ?? 480,
//       );
//       const deficitDetectionEnabled =
//         config?.deficit_detection_enabled ??
//         config?.deficitDetectionEnabled ??
//         1;
//       const allowedLateStreaks =
//         Number(
//           config?.allowed_late_streaks ?? config?.allowedLateStreaks ?? 2,
//         ) || 2;
//       const streakPeriod =
//         config?.streak_period ?? config?.streakPeriod ?? "monthly";

//       const actionRolesValue =
//         actionRoles && typeof actionRoles === "object"
//           ? JSON.stringify(actionRoles)
//           : actionRoles ||
//             JSON.stringify({ hr: true, manager: true, supervisor: false });

//       const params = [
//         orgId,
//         punchInStart,
//         punchOutStart,
//         bufferMinutes,
//         lateLoginEnabled ? 1 : 0,
//         lateStreakDays,
//         autoMarkLate ? 1 : 0,
//         escalationMode,
//         actionRolesValue,
//         requiredDailyMinutes,
//         deficitDetectionEnabled ? 1 : 0,
//         allowedLateStreaks,
//         streakPeriod,
//       ];

//       const [result] = await tenantPool.execute(
//         attendanceQueries.UPSERT_LOGIN_HOURS_CONFIG,
//         params,
//       );

//       return result;
//     } catch (error) {
//       console.error("Error in upsertLoginHoursConfig:", error);
//       throw error;
//     }
//   },

//   fetchLatestPunchRecord: async (employeeId, orgId) => {
//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);
//       const [rows] = await tenantPool.execute(
//         `SELECT employee_id, punch_status, punchin_time, punchin_device, punchin_location,
//                 punchout_time, punchout_device, punchout_location, punchmode
//          FROM emp_attendence
//          WHERE employee_id = ?
//          ORDER BY GREATEST(
//            COALESCE(punchin_time, '0000-00-00'),
//            COALESCE(punchout_time, '0000-00-00')
//          ) DESC
//          LIMIT 1`,
//         [employeeId],
//       );
//       return rows.length > 0 ? rows[0] : null;
//     } catch (error) {
//       console.error("Error in fetchLatestPunchRecord:", error);
//       throw error;
//     }
//   },
//   getAssignedOfficeLocations: async (employeeId, orgId) => {
//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);

//       const [rows] = await tenantPool.execute(
//         `
//         SELECT 
//           ol.id,
//           ol.office_name,
//           ol.address,
//           ol.latitude,
//           ol.longitude,
//           ol.radius
//         FROM office_location_employees ole
//         INNER JOIN office_locations ol
//           ON ol.id = ole.office_location_id
//         WHERE ole.employee_id = ?
//           AND ol.status = 'Active'
//         `,
//         [employeeId],
//       );

//       return rows || [];
//     } catch (error) {
//       console.error("Error in getAssignedOfficeLocations:", error);
//       throw error;
//     }
//   },

//   calculateDistanceMeters: (lat1, lon1, lat2, lon2) => {
//     const toRad = (deg) => (deg * Math.PI) / 180;
//     const R = 6371000; // meters

//     const dLat = toRad(lat2 - lat1);
//     const dLon = toRad(lon2 - lon1);

//     const a =
//       Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//       Math.cos(toRad(lat1)) *
//         Math.cos(toRad(lat2)) *
//         Math.sin(dLon / 2) *
//         Math.sin(dLon / 2);

//     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

//     return R * c;
//   },

//   validateEmployeePunchInLocation: async (
//     employeeId,
//     latitude,
//     longitude,
//     orgId,
//   ) => {
//     try {
//       const assignedLocations =
//         await attendanceService.getAssignedOfficeLocations(employeeId, orgId);

//       // No assigned office -> WFH employee -> skip location validation
//       if (!assignedLocations || assignedLocations.length === 0) {
//         return {
//           allowed: true,
//           isWFH: true,
//           matchedOffice: null,
//           message: "No office location assigned. Employee allowed as Work From Home.",
//         };
//       }

//       // Employee has assigned office(s), so lat/lng must be present
//       if (
//         latitude === undefined ||
//         latitude === null ||
//         longitude === undefined ||
//         longitude === null
//       ) {
//         return {
//           allowed: false,
//           isWFH: false,
//           matchedOffice: null,
//           message:
//             "Unable to verify your location. Please enable location access and try again.",
//         };
//       }

//       const userLat = Number(latitude);
//       const userLng = Number(longitude);

//       if (Number.isNaN(userLat) || Number.isNaN(userLng)) {
//         return {
//           allowed: false,
//           isWFH: false,
//           matchedOffice: null,
//           message: "Invalid location coordinates received.",
//         };
//       }

//       for (const office of assignedLocations) {
//         const officeLat = Number(office.latitude);
//         const officeLng = Number(office.longitude);
//         const officeRadius = Number(office.radius || 0);

//         const distance = attendanceService.calculateDistanceMeters(
//           userLat,
//           userLng,
//           officeLat,
//           officeLng,
//         );

//         if (distance <= officeRadius) {
//           return {
//             allowed: true,
//             isWFH: false,
//             matchedOffice: {
//               id: office.id,
//               office_name: office.office_name,
//               address: office.address,
//               radius: officeRadius,
//               distance: Math.round(distance),
//             },
//             message: `Location verified for ${office.office_name}`,
//           };
//         }
//       }

//       return {
//         allowed: false,
//         isWFH: false,
//         matchedOffice: null,
//         message:
//           "You are not within your assigned office location radius, so punch-in is not allowed.",
//       };
//     } catch (error) {
//       console.error("Error in validateEmployeePunchInLocation:", error);
//       throw error;
//     }
//   },
//   getLateLoginDates: async (employeeId, orgId, daysBack = 90) => {
//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);
//       const [rows] = await tenantPool.execute(
//         `SELECT DISTINCT DATE(punchin_time) as late_date
//          FROM emp_attendence
//          WHERE employee_id = ?
//            AND late_login = 1
//            AND punchin_time >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
//          ORDER BY late_date DESC`,
//         [employeeId, daysBack],
//       );

//       return rows.map((r) => {
//         const d = new Date(r.late_date);
//         const year = d.getFullYear();
//         const month = String(d.getMonth() + 1).padStart(2, "0");
//         const day = String(d.getDate()).padStart(2, "0");
//         return `${year}-${month}-${day}`;
//       });
//     } catch (error) {
//       console.error("Error in getLateLoginDates:", error);
//       throw error;
//     }
//   },
// };

// module.exports = attendanceService;

const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const attendanceQueries = require("../constants/attendanceQueries");

const toRadians = (value) => (value * Math.PI) / 180;

const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth radius in meters

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const attendanceService = {
  getEmployeeAttendance: async (employeeId, orgId) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      const [rows] = await tenantPool.execute(
        attendanceQueries.GET_EMPLOYEE_ATTENDANCE,
        [employeeId],
      );
      return rows;
    } catch (error) {
      console.error("Error in getEmployeeAttendance:", error);
      throw error;
    }
  },

  hasColumn: async (orgId, tableName, columnName) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      const [rows] = await tenantPool.execute(
        `SELECT 1
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
         LIMIT 1`,
        [tableName, columnName],
      );
      return Array.isArray(rows) && rows.length > 0;
    } catch (error) {
      console.error("Error in hasColumn:", error);
      throw error;
    }
  },

  validateEmployeeOfficeLocation: async (
    employeeId,
    latitude,
    longitude,
    orgId,
  ) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);

      if (
        latitude === undefined ||
        longitude === undefined ||
        Number.isNaN(Number(latitude)) ||
        Number.isNaN(Number(longitude))
      ) {
        return {
          allowed: false,
          message: "Valid latitude and longitude are required",
        };
      }

      const [rows] = await tenantPool.execute(
        attendanceQueries.GET_EMPLOYEE_ASSIGNED_OFFICES,
        [employeeId],
      );

      if (!rows || rows.length === 0) {
        return {
          allowed: false,
          message: "No office location assigned for this employee",
        };
      }

      let nearestOffice = null;
      let nearestDistance = null;

      for (const office of rows) {
        const distance = calculateDistanceMeters(
          Number(latitude),
          Number(longitude),
          Number(office.latitude),
          Number(office.longitude),
        );

        if (nearestDistance === null || distance < nearestDistance) {
          nearestDistance = distance;
          nearestOffice = office;
        }

        if (distance <= Number(office.radius)) {
          return {
            allowed: true,
            message: "Location validated successfully",
            office: {
              id: office.id,
              office_name: office.office_name,
              address: office.address,
              radius: office.radius,
            },
            distance: Math.round(distance),
          };
        }
      }

      return {
        allowed: false,
        message: `You are outside office radius. Nearest assigned office is ${
          nearestOffice?.office_name || "Office"
        } and your current distance is ${
          nearestDistance ? Math.round(nearestDistance) : "N/A"
        } meters`,
        office: nearestOffice
          ? {
              id: nearestOffice.id,
              office_name: nearestOffice.office_name,
              address: nearestOffice.address,
              radius: nearestOffice.radius,
            }
          : null,
        distance: nearestDistance ? Math.round(nearestDistance) : null,
      };
    } catch (error) {
      console.error("Error in validateEmployeeOfficeLocation:", error);
      throw error;
    }
  },

  addPunchIn: async (
    employeeId,
    device,
    location,
    punchMode,
    orgId,
    lateLogin = false,
  ) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      const lateLoginColumnExists = await attendanceService.hasColumn(
        orgId,
        "emp_attendence",
        "late_login",
      );

      let query = attendanceQueries.ADD_PUNCH_IN;
      let params = [employeeId, device, location, punchMode];

      if (lateLoginColumnExists) {
        query = `
          INSERT INTO emp_attendence (
            employee_id,
            punch_status,
            punchin_time,
            punchin_device,
            punchin_location,
            punchmode,
            late_login
          ) VALUES (?, 'Punch In', NOW(), ?, ?, ?, ?)
        `;
        params = [employeeId, device, location, punchMode, lateLogin ? 1 : 0];
      }

      const [result] = await tenantPool.execute(query, params);
      return result.insertId;
    } catch (error) {
      console.error("Error in addPunchIn:", error);
      throw error;
    }
  },

  updatePunchOut: async (employeeId, device, location, punchMode, orgId) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      const [result] = await tenantPool.execute(
        attendanceQueries.UPDATE_PUNCH_OUT,
        [device, location, punchMode, employeeId],
      );
      return result.affectedRows;
    } catch (error) {
      console.error("Error in updatePunchOut:", error);
      throw error;
    }
  },

  getLastPunchStatus: async (employeeId, orgId) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      const [rows] = await tenantPool.execute(
        attendanceQueries.GET_LAST_PUNCH_STATUS,
        [employeeId],
      );
      return rows.length ? rows[0].punch_status : null;
    } catch (error) {
      console.error("Error in getLastPunchStatus:", error);
      throw error;
    }
  },

  getTodayAttendance: async (orgId) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      const [rows] = await tenantPool.execute(
        attendanceQueries.GET_TODAY_ATTENDANCE,
      );
      return rows;
    } catch (error) {
      console.error("Error in getTodayAttendance:", error);
      throw error;
    }
  },

  getLatestPunchIn: async (employeeId, orgId) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      const [rows] = await tenantPool.execute(
        attendanceQueries.GET_LATEST_PUNCH_IN,
        [employeeId],
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error("Error in getLatestPunchIn:", error);
      throw error;
    }
  },

  getLatestPunchOut: async (employeeId, orgId) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      const [rows] = await tenantPool.execute(
        attendanceQueries.GET_LATEST_PUNCH_OUT,
        [employeeId],
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error("Error in getLatestPunchOut:", error);
      throw error;
    }
  },

  getLoginHoursConfig: async (orgId) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);

      const [rows] = await tenantPool.execute(
        `SELECT *
         FROM login_hours_config
         WHERE org_id = ?
         ORDER BY id DESC
         LIMIT 1`,
        [orgId],
      );

      if (!rows || rows.length === 0) return null;

      const row = rows[0];

      try {
        if (row.action_roles && typeof row.action_roles === "string") {
          row.action_roles = JSON.parse(row.action_roles);
        }
      } catch (e) {
        // ignore parse errors
      }

      return row;
    } catch (error) {
      console.error("Error in getLoginHoursConfig:", error);
      throw error;
    }
  },

  upsertLoginHoursConfig: async (orgId, config) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);

      const punchInStart =
        config?.punch_in_start ?? config?.punchInStart ?? null;
      const punchOutStart =
        config?.punch_out_start ?? config?.punchOutStart ?? null;
      const bufferMinutes = Number(
        config?.attendance_punch_buffer_minutes ??
          config?.buffer_minutes ??
          config?.bufferMinutes ??
          10,
      );
      const lateLoginEnabled =
        config?.late_login_enabled ?? config?.lateLoginEnabled ?? 1;
      const lateStreakDays =
        Number(config?.late_login_streak_days ?? config?.lateStreakDays ?? 3) ||
        3;
      const autoMarkLate = config?.auto_mark_late ?? config?.autoMarkLate ?? 1;
      const escalationMode =
        config?.late_escalation_mode ?? config?.escalationMode ?? "mail_notify";
      const actionRoles =
        config?.late_action_roles ??
        config?.action_roles ??
        config?.actionRoles ??
        null;
      const requiredDailyMinutes = Number(
        config?.required_daily_minutes ?? config?.requiredDailyMinutes ?? 480,
      );
      const deficitDetectionEnabled =
        config?.deficit_detection_enabled ??
        config?.deficitDetectionEnabled ??
        1;
      const allowedLateStreaks =
        Number(
          config?.allowed_late_streaks ?? config?.allowedLateStreaks ?? 2,
        ) || 2;
      const streakPeriod =
        config?.streak_period ?? config?.streakPeriod ?? "monthly";

      const actionRolesValue =
        actionRoles && typeof actionRoles === "object"
          ? JSON.stringify(actionRoles)
          : actionRoles ||
            JSON.stringify({ hr: true, manager: true, supervisor: false });

      const params = [
        orgId,
        punchInStart,
        punchOutStart,
        bufferMinutes,
        lateLoginEnabled ? 1 : 0,
        lateStreakDays,
        autoMarkLate ? 1 : 0,
        escalationMode,
        actionRolesValue,
        requiredDailyMinutes,
        deficitDetectionEnabled ? 1 : 0,
        allowedLateStreaks,
        streakPeriod,
      ];

      const [result] = await tenantPool.execute(
        attendanceQueries.UPSERT_LOGIN_HOURS_CONFIG,
        params,
      );

      return result;
    } catch (error) {
      console.error("Error in upsertLoginHoursConfig:", error);
      throw error;
    }
  },

  fetchLatestPunchRecord: async (employeeId, orgId) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      const [rows] = await tenantPool.execute(
        `SELECT employee_id, punch_status, punchin_time, punchin_device, punchin_location,
                punchout_time, punchout_device, punchout_location, punchmode
         FROM emp_attendence
         WHERE employee_id = ?
         ORDER BY GREATEST(
           COALESCE(punchin_time, '0000-00-00'),
           COALESCE(punchout_time, '0000-00-00')
         ) DESC
         LIMIT 1`,
        [employeeId],
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error("Error in fetchLatestPunchRecord:", error);
      throw error;
    }
  },

  getLateLoginDates: async (employeeId, orgId, daysBack = 90) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      const [rows] = await tenantPool.execute(
        `SELECT DISTINCT DATE(punchin_time) as late_date
         FROM emp_attendence
         WHERE employee_id = ?
           AND late_login = 1
           AND punchin_time >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         ORDER BY late_date DESC`,
        [employeeId, daysBack],
      );

      return rows.map((r) => {
        const d = new Date(r.late_date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      });
    } catch (error) {
      console.error("Error in getLateLoginDates:", error);
      throw error;
    }
  },
};

module.exports = attendanceService;