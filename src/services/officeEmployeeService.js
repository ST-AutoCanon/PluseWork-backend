// const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
// const OFFICE_EMPLOYEE_QUERIES = require("../constants/officeEmployeeQueries");

// class OfficeEmployeeService {
//   static formatEmployee(emp) {
//     return {
//       employee_id: emp.employee_id,
//       name: [emp.first_name, emp.middle_name, emp.last_name]
//         .filter(Boolean)
//         .join(" "),
//       email: emp.email,
//       phone_number: emp.phone_number,
//       status: emp.status,
//       office_location_id: emp.office_location_id || null,
//       assigned_at: emp.assigned_at || null,
//       mapping_id: emp.mapping_id || null,
//     };
//   }

//   static async getAllEmployees(orgId) {
//     if (!orgId) throw new Error("orgId is required");

//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);

//       const [rows] = await tenantPool.query(
//         OFFICE_EMPLOYEE_QUERIES.GET_ALL_EMPLOYEES
//       );

//       return (rows || []).map((emp) => this.formatEmployee(emp));
//     } catch (error) {
//       console.error("[OfficeEmployeeService] getAllEmployees error:", error);
//       throw new Error(error.message || "Failed to fetch employees");
//     }
//   }

//   static async getEmployeesByOfficeLocation(orgId, officeLocationId) {
//     if (!orgId) throw new Error("orgId is required");
//     if (!officeLocationId) throw new Error("officeLocationId is required");

//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);

//       const [officeRows] = await tenantPool.query(
//         OFFICE_EMPLOYEE_QUERIES.GET_OFFICE_LOCATION_BY_ID,
//         [officeLocationId]
//       );

//       if (!officeRows.length) {
//         throw new Error("Office location not found");
//       }

//       const [rows] = await tenantPool.query(
//         OFFICE_EMPLOYEE_QUERIES.GET_EMPLOYEES_BY_OFFICE_LOCATION,
//         [officeLocationId]
//       );

//       return {
//         office: officeRows[0],
//         employees: (rows || []).map((emp) => this.formatEmployee(emp)),
//       };
//     } catch (error) {
//       console.error(
//         "[OfficeEmployeeService] getEmployeesByOfficeLocation error:",
//         error
//       );
//       throw new Error(error.message || "Failed to fetch office employees");
//     }
//   }

//   static async assignEmployeesToOffice(orgId, officeLocationId, employeeIds = []) {
//     if (!orgId) throw new Error("orgId is required");
//     if (!officeLocationId) throw new Error("officeLocationId is required");

//     if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
//       throw new Error("employeeIds array is required");
//     }

//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);

//       const [officeRows] = await tenantPool.query(
//         OFFICE_EMPLOYEE_QUERIES.GET_OFFICE_LOCATION_BY_ID,
//         [officeLocationId]
//       );

//       if (!officeRows.length) {
//         throw new Error("Office location not found");
//       }

//       for (const employeeId of employeeIds) {
//         const [employeeRows] = await tenantPool.query(
//           OFFICE_EMPLOYEE_QUERIES.GET_EMPLOYEE_BY_ID,
//           [employeeId]
//         );

//         if (!employeeRows.length) {
//           throw new Error(`Employee not found: ${employeeId}`);
//         }

//         const [mappingRows] = await tenantPool.query(
//           OFFICE_EMPLOYEE_QUERIES.CHECK_EMPLOYEE_OFFICE_MAPPING,
//           [officeLocationId, employeeId]
//         );

//         if (!mappingRows.length) {
//           await tenantPool.query(
//             OFFICE_EMPLOYEE_QUERIES.ASSIGN_EMPLOYEE_TO_OFFICE,
//             [officeLocationId, employeeId]
//           );
//         }
//       }

//       const [updatedEmployees] = await tenantPool.query(
//         OFFICE_EMPLOYEE_QUERIES.GET_EMPLOYEES_BY_OFFICE_LOCATION,
//         [officeLocationId]
//       );

//       return {
//         office: officeRows[0],
//         employees: (updatedEmployees || []).map((emp) => this.formatEmployee(emp)),
//       };
//     } catch (error) {
//       console.error("[OfficeEmployeeService] assignEmployeesToOffice error:", error);
//       throw new Error(error.message || "Failed to assign employees to office");
//     }
//   }

//   static async removeEmployeeFromOffice(orgId, officeLocationId, employeeId) {
//     if (!orgId) throw new Error("orgId is required");
//     if (!officeLocationId) throw new Error("officeLocationId is required");
//     if (!employeeId) throw new Error("employeeId is required");

//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);

//       await tenantPool.query(
//         OFFICE_EMPLOYEE_QUERIES.REMOVE_EMPLOYEE_FROM_OFFICE,
//         [officeLocationId, employeeId]
//       );

//       return {
//         office_location_id: Number(officeLocationId),
//         employee_id: employeeId,
//       };
//     } catch (error) {
//       console.error("[OfficeEmployeeService] removeEmployeeFromOffice error:", error);
//       throw new Error(error.message || "Failed to remove employee from office");
//     }
//   }

//   // Full sync: selected employees only remain assigned to this office
//   static async syncOfficeEmployees(orgId, officeLocationId, employeeIds = []) {
//     if (!orgId) throw new Error("orgId is required");
//     if (!officeLocationId) throw new Error("officeLocationId is required");
//     if (!Array.isArray(employeeIds)) {
//       throw new Error("employeeIds must be an array");
//     }

//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);

//       const [officeRows] = await tenantPool.query(
//         OFFICE_EMPLOYEE_QUERIES.GET_OFFICE_LOCATION_BY_ID,
//         [officeLocationId]
//       );

//       if (!officeRows.length) {
//         throw new Error("Office location not found");
//       }

//       // remove all current mappings for this office
//       await tenantPool.query(
//         OFFICE_EMPLOYEE_QUERIES.REMOVE_ALL_EMPLOYEES_FROM_OFFICE,
//         [officeLocationId]
//       );

//       // insert selected mappings
//       for (const employeeId of employeeIds) {
//         const [employeeRows] = await tenantPool.query(
//           OFFICE_EMPLOYEE_QUERIES.GET_EMPLOYEE_BY_ID,
//           [employeeId]
//         );

//         if (!employeeRows.length) {
//           throw new Error(`Employee not found: ${employeeId}`);
//         }

//         await tenantPool.query(
//           OFFICE_EMPLOYEE_QUERIES.ASSIGN_EMPLOYEE_TO_OFFICE,
//           [officeLocationId, employeeId]
//         );
//       }

//       const [updatedEmployees] = await tenantPool.query(
//         OFFICE_EMPLOYEE_QUERIES.GET_EMPLOYEES_BY_OFFICE_LOCATION,
//         [officeLocationId]
//       );

//       return {
//         office: officeRows[0],
//         employees: (updatedEmployees || []).map((emp) => this.formatEmployee(emp)),
//       };
//     } catch (error) {
//       console.error("[OfficeEmployeeService] syncOfficeEmployees error:", error);
//       throw new Error(error.message || "Failed to sync office employees");
//     }
//   }

//   static async getEmployeeCountByOffice(orgId, officeLocationId) {
//     if (!orgId) throw new Error("orgId is required");
//     if (!officeLocationId) throw new Error("officeLocationId is required");

//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);

//       const [rows] = await tenantPool.query(
//         OFFICE_EMPLOYEE_QUERIES.GET_EMPLOYEE_COUNT_BY_OFFICE,
//         [officeLocationId]
//       );

//       return rows?.[0]?.total_employees || 0;
//     } catch (error) {
//       console.error("[OfficeEmployeeService] getEmployeeCountByOffice error:", error);
//       throw new Error(error.message || "Failed to get employee count");
//     }
//   }
// }

// module.exports = OfficeEmployeeService;

// const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
// const OFFICE_EMPLOYEE_QUERIES = require("../constants/officeEmployeeQueries");

// class OfficeEmployeeService {
//   static formatEmployee(emp) {
//     return {
//       employee_id: emp.employee_id,
//       name: [emp.first_name, emp.middle_name, emp.last_name]
//         .filter(Boolean)
//         .join(" "),
//       email: emp.email,
//       phone_number: emp.phone_number,
//       status: emp.status,
//       office_location_id: emp.office_location_id || null,
//       assigned_at: emp.assigned_at || null,
//       mapping_id: emp.mapping_id || null,
//     };
//   }

//   static async getAllEmployees(orgId) {
//     if (!orgId) throw new Error("orgId is required");

//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);

//       const [rows] = await tenantPool.query(
//         OFFICE_EMPLOYEE_QUERIES.GET_ALL_EMPLOYEES
//       );

//       return (rows || []).map((emp) => this.formatEmployee(emp));
//     } catch (error) {
//       console.error("[OfficeEmployeeService] getAllEmployees error:", error);
//       throw new Error(error.message || "Failed to fetch employees");
//     }
//   }

//   static async getEmployeesByOfficeLocation(orgId, officeLocationId) {
//     if (!orgId) throw new Error("orgId is required");
//     if (!officeLocationId) throw new Error("officeLocationId is required");

//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);

//       const [officeRows] = await tenantPool.query(
//         OFFICE_EMPLOYEE_QUERIES.GET_OFFICE_LOCATION_BY_ID,
//         [officeLocationId]
//       );

//       if (!officeRows.length) {
//         throw new Error("Office location not found");
//       }

//       const [rows] = await tenantPool.query(
//         OFFICE_EMPLOYEE_QUERIES.GET_EMPLOYEES_BY_OFFICE_LOCATION,
//         [officeLocationId]
//       );

//       return {
//         office: officeRows[0],
//         employees: (rows || []).map((emp) => this.formatEmployee(emp)),
//       };
//     } catch (error) {
//       console.error(
//         "[OfficeEmployeeService] getEmployeesByOfficeLocation error:",
//         error
//       );
//       throw new Error(error.message || "Failed to fetch office employees");
//     }
//   }

//   static async assignEmployeesToOffice(
//     orgId,
//     officeLocationId,
//     employeeIds = [],
//     forceAssign = false
//   ) {
//     if (!orgId) throw new Error("orgId is required");
//     if (!officeLocationId) throw new Error("officeLocationId is required");

//     if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
//       throw new Error("employeeIds array is required");
//     }

//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);

//       const [officeRows] = await tenantPool.query(
//         OFFICE_EMPLOYEE_QUERIES.GET_OFFICE_LOCATION_BY_ID,
//         [officeLocationId]
//       );

//       if (!officeRows.length) {
//         throw new Error("Office location not found");
//       }

//       const targetOffice = officeRows[0];

//       const conflictEmployees = [];
//       const insertedEmployees = [];
//       const alreadyMappedEmployees = [];

//       for (const employeeId of employeeIds) {
//         const [employeeRows] = await tenantPool.query(
//           OFFICE_EMPLOYEE_QUERIES.GET_EMPLOYEE_BY_ID,
//           [employeeId]
//         );

//         if (!employeeRows.length) {
//           throw new Error(`Employee not found: ${employeeId}`);
//         }

//         const employee = employeeRows[0];

//         // 1) same office duplicate check
//         const [sameOfficeMapping] = await tenantPool.query(
//           OFFICE_EMPLOYEE_QUERIES.CHECK_EMPLOYEE_OFFICE_MAPPING,
//           [officeLocationId, employeeId]
//         );

//         if (sameOfficeMapping.length) {
//           alreadyMappedEmployees.push({
//             employee_id: employee.employee_id,
//             name: [employee.first_name, employee.middle_name, employee.last_name]
//               .filter(Boolean)
//               .join(" "),
//             message: "Employee already assigned to this office",
//           });
//           continue;
//         }

//         // 2) check other office assignments
//         const [otherOfficeAssignments] = await tenantPool.query(
//           OFFICE_EMPLOYEE_QUERIES.GET_EMPLOYEE_OTHER_OFFICE_ASSIGNMENTS,
//           [employeeId, officeLocationId]
//         );

//         if (otherOfficeAssignments.length > 0 && !forceAssign) {
//           conflictEmployees.push({
//             employee_id: employee.employee_id,
//             name: [employee.first_name, employee.middle_name, employee.last_name]
//               .filter(Boolean)
//               .join(" "),
//             existing_offices: otherOfficeAssignments.map((row) => ({
//               office_location_id: row.office_location_id,
//               office_name: row.office_name,
//               address: row.address,
//               assigned_at: row.assigned_at,
//             })),
//           });
//           continue;
//         }

//         // 3) insert mapping
//         await tenantPool.query(
//           OFFICE_EMPLOYEE_QUERIES.ASSIGN_EMPLOYEE_TO_OFFICE,
//           [officeLocationId, employeeId]
//         );

//         insertedEmployees.push({
//           employee_id: employee.employee_id,
//           name: [employee.first_name, employee.middle_name, employee.last_name]
//             .filter(Boolean)
//             .join(" "),
//         });
//       }

//       // If conflict found and forceAssign=false -> return conflict response
//       if (conflictEmployees.length > 0 && !forceAssign) {
//         return {
//           success: false,
//           requiresConfirmation: true,
//           office: targetOffice,
//           conflictEmployees,
//           alreadyMappedEmployees,
//         };
//       }

//       const [updatedEmployees] = await tenantPool.query(
//         OFFICE_EMPLOYEE_QUERIES.GET_EMPLOYEES_BY_OFFICE_LOCATION,
//         [officeLocationId]
//       );

//       return {
//         success: true,
//         office: targetOffice,
//         insertedEmployees,
//         alreadyMappedEmployees,
//         employees: (updatedEmployees || []).map((emp) => this.formatEmployee(emp)),
//       };
//     } catch (error) {
//       console.error("[OfficeEmployeeService] assignEmployeesToOffice error:", error);
//       throw new Error(error.message || "Failed to assign employees to office");
//     }
//   }

//   static async removeEmployeeFromOffice(orgId, officeLocationId, employeeId) {
//     if (!orgId) throw new Error("orgId is required");
//     if (!officeLocationId) throw new Error("officeLocationId is required");
//     if (!employeeId) throw new Error("employeeId is required");

//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);

//       await tenantPool.query(
//         OFFICE_EMPLOYEE_QUERIES.REMOVE_EMPLOYEE_FROM_OFFICE,
//         [officeLocationId, employeeId]
//       );

//       return {
//         office_location_id: Number(officeLocationId),
//         employee_id: employeeId,
//       };
//     } catch (error) {
//       console.error("[OfficeEmployeeService] removeEmployeeFromOffice error:", error);
//       throw new Error(error.message || "Failed to remove employee from office");
//     }
//   }

//   static async syncOfficeEmployees(orgId, officeLocationId, employeeIds = []) {
//     if (!orgId) throw new Error("orgId is required");
//     if (!officeLocationId) throw new Error("officeLocationId is required");
//     if (!Array.isArray(employeeIds)) {
//       throw new Error("employeeIds must be an array");
//     }

//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);

//       const [officeRows] = await tenantPool.query(
//         OFFICE_EMPLOYEE_QUERIES.GET_OFFICE_LOCATION_BY_ID,
//         [officeLocationId]
//       );

//       if (!officeRows.length) {
//         throw new Error("Office location not found");
//       }

//       await tenantPool.query(
//         OFFICE_EMPLOYEE_QUERIES.REMOVE_ALL_EMPLOYEES_FROM_OFFICE,
//         [officeLocationId]
//       );

//       for (const employeeId of employeeIds) {
//         const [employeeRows] = await tenantPool.query(
//           OFFICE_EMPLOYEE_QUERIES.GET_EMPLOYEE_BY_ID,
//           [employeeId]
//         );

//         if (!employeeRows.length) {
//           throw new Error(`Employee not found: ${employeeId}`);
//         }

//         await tenantPool.query(
//           OFFICE_EMPLOYEE_QUERIES.ASSIGN_EMPLOYEE_TO_OFFICE,
//           [officeLocationId, employeeId]
//         );
//       }

//       const [updatedEmployees] = await tenantPool.query(
//         OFFICE_EMPLOYEE_QUERIES.GET_EMPLOYEES_BY_OFFICE_LOCATION,
//         [officeLocationId]
//       );

//       return {
//         office: officeRows[0],
//         employees: (updatedEmployees || []).map((emp) => this.formatEmployee(emp)),
//       };
//     } catch (error) {
//       console.error("[OfficeEmployeeService] syncOfficeEmployees error:", error);
//       throw new Error(error.message || "Failed to sync office employees");
//     }
//   }

//   static async getEmployeeCountByOffice(orgId, officeLocationId) {
//     if (!orgId) throw new Error("orgId is required");
//     if (!officeLocationId) throw new Error("officeLocationId is required");

//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);

//       const [rows] = await tenantPool.query(
//         OFFICE_EMPLOYEE_QUERIES.GET_EMPLOYEE_COUNT_BY_OFFICE,
//         [officeLocationId]
//       );

//       return rows?.[0]?.total_employees || 0;
//     } catch (error) {
//       console.error("[OfficeEmployeeService] getEmployeeCountByOffice error:", error);
//       throw new Error(error.message || "Failed to get employee count");
//     }
//   }
// }

// module.exports = OfficeEmployeeService;

const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const OFFICE_EMPLOYEE_QUERIES = require("../constants/officeEmployeeQueries");

class OfficeEmployeeService {
  static formatEmployee(emp) {
    return {
      employee_id: emp.employee_id,
      name: [emp.first_name, emp.middle_name, emp.last_name]
        .filter(Boolean)
        .join(" "),
      email: emp.email,
      phone_number: emp.phone_number,
      status: emp.status,
      office_location_id: emp.office_location_id || null,
      assigned_at: emp.assigned_at || null,
      mapping_id: emp.mapping_id || null,
    };
  }

  static async getAllEmployees(orgId) {
    if (!orgId) throw new Error("orgId is required");

    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);

      const [rows] = await tenantPool.query(
        OFFICE_EMPLOYEE_QUERIES.GET_ALL_EMPLOYEES
      );

      return (rows || []).map((emp) => this.formatEmployee(emp));
    } catch (error) {
      console.error("[OfficeEmployeeService] getAllEmployees error:", error);
      throw new Error(error.message || "Failed to fetch employees");
    }
  }

  static async getEmployeesByOfficeLocation(orgId, officeLocationId) {
    if (!orgId) throw new Error("orgId is required");
    if (!officeLocationId) throw new Error("officeLocationId is required");

    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);

      const [officeRows] = await tenantPool.query(
        OFFICE_EMPLOYEE_QUERIES.GET_OFFICE_LOCATION_BY_ID,
        [officeLocationId]
      );

      if (!officeRows.length) {
        throw new Error("Office location not found");
      }

      const [rows] = await tenantPool.query(
        OFFICE_EMPLOYEE_QUERIES.GET_EMPLOYEES_BY_OFFICE_LOCATION,
        [officeLocationId]
      );

      return {
        office: officeRows[0],
        employees: (rows || []).map((emp) => this.formatEmployee(emp)),
      };
    } catch (error) {
      console.error(
        "[OfficeEmployeeService] getEmployeesByOfficeLocation error:",
        error
      );
      throw new Error(error.message || "Failed to fetch office employees");
    }
  }

  // NEW: used before assign to show popup if employee already assigned in other office
  static async checkEmployeeAssignments(orgId, officeLocationId, employeeIds = []) {
    if (!orgId) throw new Error("orgId is required");
    if (!officeLocationId) throw new Error("officeLocationId is required");
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      throw new Error("employeeIds array is required");
    }

    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);

      const [officeRows] = await tenantPool.query(
        OFFICE_EMPLOYEE_QUERIES.GET_OFFICE_LOCATION_BY_ID,
        [officeLocationId]
      );

      if (!officeRows.length) {
        throw new Error("Office location not found");
      }

      const targetOffice = officeRows[0];
      const conflictEmployees = [];
      const alreadyMappedEmployees = [];

      for (const employeeId of employeeIds) {
        const [employeeRows] = await tenantPool.query(
          OFFICE_EMPLOYEE_QUERIES.GET_EMPLOYEE_BY_ID,
          [employeeId]
        );

        if (!employeeRows.length) continue;

        const employee = employeeRows[0];
        const employeeName = [
          employee.first_name,
          employee.middle_name,
          employee.last_name,
        ]
          .filter(Boolean)
          .join(" ");

        // already in same office?
        const [sameOfficeMapping] = await tenantPool.query(
          OFFICE_EMPLOYEE_QUERIES.CHECK_EMPLOYEE_OFFICE_MAPPING,
          [officeLocationId, employeeId]
        );

        if (sameOfficeMapping.length) {
          alreadyMappedEmployees.push({
            employee_id: employee.employee_id,
            name: employeeName,
            message: "Employee already assigned to this office",
          });
          continue;
        }

        // already in other offices?
        const [otherOfficeAssignments] = await tenantPool.query(
          OFFICE_EMPLOYEE_QUERIES.GET_EMPLOYEE_OTHER_OFFICE_ASSIGNMENTS,
          [employeeId, officeLocationId]
        );

        if (otherOfficeAssignments.length > 0) {
          conflictEmployees.push({
            employee_id: employee.employee_id,
            name: employeeName,
            existing_offices: otherOfficeAssignments.map((row) => ({
              office_location_id: row.office_location_id,
              office_name: row.office_name,
              address: row.address,
              assigned_at: row.assigned_at,
            })),
          });
        }
      }

      return {
        office: targetOffice,
        requiresConfirmation: conflictEmployees.length > 0,
        conflictEmployees,
        alreadyMappedEmployees,
      };
    } catch (error) {
      console.error("[OfficeEmployeeService] checkEmployeeAssignments error:", error);
      throw new Error(error.message || "Failed to check employee assignments");
    }
  }

  static async assignEmployeesToOffice(
    orgId,
    officeLocationId,
    employeeIds = [],
    forceAssign = false
  ) {
    if (!orgId) throw new Error("orgId is required");
    if (!officeLocationId) throw new Error("officeLocationId is required");

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      throw new Error("employeeIds array is required");
    }

    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);

      const [officeRows] = await tenantPool.query(
        OFFICE_EMPLOYEE_QUERIES.GET_OFFICE_LOCATION_BY_ID,
        [officeLocationId]
      );

      if (!officeRows.length) {
        throw new Error("Office location not found");
      }

      const targetOffice = officeRows[0];

      const conflictEmployees = [];
      const insertedEmployees = [];
      const alreadyMappedEmployees = [];

      for (const employeeId of employeeIds) {
        const [employeeRows] = await tenantPool.query(
          OFFICE_EMPLOYEE_QUERIES.GET_EMPLOYEE_BY_ID,
          [employeeId]
        );

        if (!employeeRows.length) {
          throw new Error(`Employee not found: ${employeeId}`);
        }

        const employee = employeeRows[0];
        const employeeName = [
          employee.first_name,
          employee.middle_name,
          employee.last_name,
        ]
          .filter(Boolean)
          .join(" ");

        // same office duplicate check
        const [sameOfficeMapping] = await tenantPool.query(
          OFFICE_EMPLOYEE_QUERIES.CHECK_EMPLOYEE_OFFICE_MAPPING,
          [officeLocationId, employeeId]
        );

        if (sameOfficeMapping.length) {
          alreadyMappedEmployees.push({
            employee_id: employee.employee_id,
            name: employeeName,
            message: "Employee already assigned to this office",
          });
          continue;
        }

        // other office assignment check
        const [otherOfficeAssignments] = await tenantPool.query(
          OFFICE_EMPLOYEE_QUERIES.GET_EMPLOYEE_OTHER_OFFICE_ASSIGNMENTS,
          [employeeId, officeLocationId]
        );

        if (otherOfficeAssignments.length > 0 && !forceAssign) {
          conflictEmployees.push({
            employee_id: employee.employee_id,
            name: employeeName,
            existing_offices: otherOfficeAssignments.map((row) => ({
              office_location_id: row.office_location_id,
              office_name: row.office_name,
              address: row.address,
              assigned_at: row.assigned_at,
            })),
          });
          continue;
        }

        await tenantPool.query(
          OFFICE_EMPLOYEE_QUERIES.ASSIGN_EMPLOYEE_TO_OFFICE,
          [officeLocationId, employeeId]
        );

        insertedEmployees.push({
          employee_id: employee.employee_id,
          name: employeeName,
        });
      }

      if (conflictEmployees.length > 0 && !forceAssign) {
        return {
          success: false,
          requiresConfirmation: true,
          office: targetOffice,
          conflictEmployees,
          alreadyMappedEmployees,
        };
      }

      const [updatedEmployees] = await tenantPool.query(
        OFFICE_EMPLOYEE_QUERIES.GET_EMPLOYEES_BY_OFFICE_LOCATION,
        [officeLocationId]
      );

      return {
        success: true,
        office: targetOffice,
        insertedEmployees,
        alreadyMappedEmployees,
        employees: (updatedEmployees || []).map((emp) => this.formatEmployee(emp)),
      };
    } catch (error) {
      console.error("[OfficeEmployeeService] assignEmployeesToOffice error:", error);
      throw new Error(error.message || "Failed to assign employees to office");
    }
  }

  static async removeEmployeeFromOffice(orgId, officeLocationId, employeeId) {
    if (!orgId) throw new Error("orgId is required");
    if (!officeLocationId) throw new Error("officeLocationId is required");
    if (!employeeId) throw new Error("employeeId is required");

    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);

      await tenantPool.query(
        OFFICE_EMPLOYEE_QUERIES.REMOVE_EMPLOYEE_FROM_OFFICE,
        [officeLocationId, employeeId]
      );

      return {
        office_location_id: Number(officeLocationId),
        employee_id: employeeId,
      };
    } catch (error) {
      console.error("[OfficeEmployeeService] removeEmployeeFromOffice error:", error);
      throw new Error(error.message || "Failed to remove employee from office");
    }
  }

  static async syncOfficeEmployees(orgId, officeLocationId, employeeIds = []) {
    if (!orgId) throw new Error("orgId is required");
    if (!officeLocationId) throw new Error("officeLocationId is required");
    if (!Array.isArray(employeeIds)) {
      throw new Error("employeeIds must be an array");
    }

    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);

      const [officeRows] = await tenantPool.query(
        OFFICE_EMPLOYEE_QUERIES.GET_OFFICE_LOCATION_BY_ID,
        [officeLocationId]
      );

      if (!officeRows.length) {
        throw new Error("Office location not found");
      }

      await tenantPool.query(
        OFFICE_EMPLOYEE_QUERIES.REMOVE_ALL_EMPLOYEES_FROM_OFFICE,
        [officeLocationId]
      );

      for (const employeeId of employeeIds) {
        const [employeeRows] = await tenantPool.query(
          OFFICE_EMPLOYEE_QUERIES.GET_EMPLOYEE_BY_ID,
          [employeeId]
        );

        if (!employeeRows.length) {
          throw new Error(`Employee not found: ${employeeId}`);
        }

        await tenantPool.query(
          OFFICE_EMPLOYEE_QUERIES.ASSIGN_EMPLOYEE_TO_OFFICE,
          [officeLocationId, employeeId]
        );
      }

      const [updatedEmployees] = await tenantPool.query(
        OFFICE_EMPLOYEE_QUERIES.GET_EMPLOYEES_BY_OFFICE_LOCATION,
        [officeLocationId]
      );

      return {
        office: officeRows[0],
        employees: (updatedEmployees || []).map((emp) => this.formatEmployee(emp)),
      };
    } catch (error) {
      console.error("[OfficeEmployeeService] syncOfficeEmployees error:", error);
      throw new Error(error.message || "Failed to sync office employees");
    }
  }

  static async getEmployeeCountByOffice(orgId, officeLocationId) {
    if (!orgId) throw new Error("orgId is required");
    if (!officeLocationId) throw new Error("officeLocationId is required");

    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);

      const [rows] = await tenantPool.query(
        OFFICE_EMPLOYEE_QUERIES.GET_EMPLOYEE_COUNT_BY_OFFICE,
        [officeLocationId]
      );

      return rows?.[0]?.total_employees || 0;
    } catch (error) {
      console.error("[OfficeEmployeeService] getEmployeeCountByOffice error:", error);
      throw new Error(error.message || "Failed to get employee count");
    }
  }
}

module.exports = OfficeEmployeeService;