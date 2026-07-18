
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

  static async checkEmployeeAssignments(orgId, officeLocationId, employeeIds = []) {
    if (!orgId) throw new Error("orgId is required");
    if (!officeLocationId) throw new Error("officeLocationId is required");

    // Allow empty array
    if (!Array.isArray(employeeIds)) {
      employeeIds = [];
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

    // Allow empty array (unassign all)
    if (!Array.isArray(employeeIds)) {
      employeeIds = [];
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

      // If empty array → remove all employees from this office
      if (employeeIds.length === 0) {
        await tenantPool.query(
          OFFICE_EMPLOYEE_QUERIES.REMOVE_ALL_EMPLOYEES_FROM_OFFICE,
          [officeLocationId]
        );

        return {
          success: true,
          office: targetOffice,
          insertedEmployees: [],
          alreadyMappedEmployees: [],
          employees: [],
          count: 0,
        };
      }

      // Normal assignment
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
      employeeIds = [];
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
}

module.exports = OfficeEmployeeService;