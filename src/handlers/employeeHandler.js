const multer = require("multer");
const path = require("path");
const fs = require("fs");
const upload = require("../utils/multerConfig");
const employeeService = require("../services/employeeService");
const ErrorHandler = require("../utils/errorHandler");
const xlsx = require("xlsx");
const db = require("../config");
const queries = require("../constants/empDetailsQueries");
const {
  getTenantPool,
  sanitizeDbName,
  getTenantPoolByOrgId,
} = require("../db/tenantPoolManager");

const getWebPath = (fullPath) => {
  const relPath = fullPath.split("EmployeeDetails").pop().replace(/\\/g, "/");
  return path.posix.join("/EmployeeDetails", relPath);
};

const resolveOrgIdFromReq = (req) => {
  const header =
    req.headers && (req.headers["x-org-id"] || req.headers["x_org_id"]);
  const body = req.body && (req.body.orgId || req.body.org_id);
  const query = req.query && (req.query.orgId || req.query.org_id);
  return header || body || query || null;
};

exports.bulkAddEmployees = async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json(
        ErrorHandler.generateErrorResponse(
          400,
          "Excel file is required for bulk upload."
        )
      );
  }

  const orgId = resolveOrgIdFromReq(req);
  if (!orgId) {
    console.warn(
      "[bulkAddEmployees] orgId not provided - employees will be created without org association"
    );
  }

  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const employeesData = xlsx.utils.sheet_to_json(worksheet);

    function excelSerialToJSDate(serial) {
      const utc_days = serial - 25569;
      const ms = utc_days * 86400 * 1000;
      return new Date(ms).toISOString().slice(0, 10);
    }

    for (let row of employeesData) {
      if (typeof row.dob === "number") {
        row.dob = excelSerialToJSDate(row.dob);
      }
      if (orgId) {
        row.org_id = row.org_id || orgId;
        row.orgId = row.orgId || orgId;
      }
    }

    fs.unlink(req.file.path, (err) => {
      if (err) console.warn("Temp file removal failed:", err);
    });

    const results = [];
    const errors = [];

    const promises = employeesData.map((employeeData) => {
      return employeeService
        .addFullEmployee(employeeData, { bypassOrgLimit: true })
        .then(() => {
          results.push({ email: employeeData.email, status: "success" });
        })
        .catch((err) => {
          console.error(
            `Error adding employee (${employeeData.email}):`,
            err.message || err
          );
          errors.push({
            email: employeeData.email,
            error: err.message || "Error adding employee",
          });
        });
    });

    await Promise.all(promises);

    return res
      .status(207)
      .json(
        ErrorHandler.generateSuccessResponse(
          207,
          "Bulk employee process completed.",
          { added: results, errors }
        )
      );
  } catch (error) {
    console.error("Bulk employee addition error:", error);
    return res
      .status(500)
      .json(
        ErrorHandler.generateErrorResponse(
          500,
          "Failed to add employees in bulk."
        )
      );
  }
};

exports.createFullEmployee = async (req, res) => {
  try {
    const data = { ...req.body };
    const raw = req.body || {};

    const orgId = resolveOrgIdFromReq(req);
    if (orgId) {
      data.org_id = data.org_id || data.orgId || orgId;
      data.orgId = data.orgId || data.org_id || orgId;
    } else {
      console.warn("[createFullEmployee] orgId not provided in request");
    }

    const tenantDb = orgId ? await getTenantPoolByOrgId(orgId) : db;

    const [emailRows] = await tenantDb.execute(queries.CHECK_EMAIL, [
      data.email,
    ]);
    if (emailRows.length) {
      return res
        .status(400)
        .json(
          ErrorHandler.generateErrorResponse(
            400,
            "Email already exists. Please use another."
          )
        );
    }

    const [persRows] = await tenantDb.execute(queries.CHECK_PERSONAL_DUP, [
      data.aadhaar_number,
      data.pan_number,
    ]);
    if (persRows.length) {
      const dup = persRows[0];
      const field =
        dup.aadhaar_number === data.aadhaar_number ? "Aadhaar" : "PAN";
      return res
        .status(400)
        .json(
          ErrorHandler.generateErrorResponse(
            400,
            `Aadhaar/PAN number already exists.`
          )
        );
    }

    let employee_id;
    try {
      const resObj = await employeeService.addFullEmployee(data);
      employee_id = resObj && resObj.employee_id;
    } catch (svcErr) {
      const msg = svcErr && svcErr.message ? String(svcErr.message) : "";

      if (msg.toLowerCase().includes("employee limit reached")) {
        const clientMessage =
          "Employee limit reached. Please contact your administrator to increase the employee limit.";
        console.warn("[createFullEmployee] org limit reached:", msg);
        return res
          .status(403)
          .json(ErrorHandler.generateErrorResponse(403, clientMessage));
      }

      throw svcErr;
    }

    try {
      if (!process.env.SENDGRID_API_KEY) {
        console.warn(
          "[createFullEmployee] SENDGRID_API_KEY missing — skipping email send"
        );
      } else if (!process.env.SENDGRID_SENDER_EMAIL) {
        console.warn(
          "[createFullEmployee] SENDGRID_SENDER_EMAIL missing — skipping email send"
        );
      } else {
        await sendResetEmail(
          data.email,
          `${data.first_name} ${data.last_name}`
        );
      }
    } catch (mailErr) {
      console.warn(
        "[createFullEmployee] warning: reset-email failed — not rolling back:",
        mailErr
      );
    }

    return res.status(201).json(
      ErrorHandler.generateSuccessResponse(201, "Employee created.", {
        employee_id,
      })
    );
  } catch (err) {
    console.error("[createFullEmployee] error:", err);
    return res
      .status(500)
      .json(
        ErrorHandler.generateErrorResponse(
          500,
          err.message || "Failed to create employee."
        )
      );
  } finally {
  }
};

exports.updateFullEmployee = async (req, res) => {
  try {
    const raw = req.body || {};
    const data = { employee_id: req.params.employeeId, ...raw };

    const orgId = resolveOrgIdFromReq(req);
    if (orgId) {
      data.org_id = data.org_id || data.orgId || orgId;
      data.orgId = data.orgId || data.org_id || orgId;
    } else {
      console.warn("[updateFullEmployee] orgId not provided in request");
    }

    const tenantDb = orgId ? await getTenantPoolByOrgId(orgId) : db;

    const [emailRows] = await tenantDb.execute(queries.CHECK_EMAIL_UPDATE, [
      data.email,
      data.employee_id,
    ]);
    if (emailRows.length) {
      return res
        .status(400)
        .json(
          ErrorHandler.generateErrorResponse(
            400,
            "Email already in use by another employee."
          )
        );
    }

    const [persRows] = await tenantDb.execute(
      queries.CHECK_PERSONAL_DUP_UPDATE,
      [data.aadhaar_number, data.pan_number, data.employee_id]
    );
    if (persRows.length) {
      const field =
        persRows[0].aadhaar_number === data.aadhaar_number ? "Aadhaar" : "PAN";
      return res
        .status(400)
        .json(
          ErrorHandler.generateErrorResponse(
            400,
            `${field} number already in use by another employee.`
          )
        );
    }

    await employeeService.editFullEmployee(data);

    return res
      .status(200)
      .json(ErrorHandler.generateSuccessResponse(200, "Employee updated."));
  } catch (err) {
    console.error("[updateFullEmployee] error:", err);
    return res
      .status(500)
      .json(
        ErrorHandler.generateErrorResponse(
          500,
          err.message || "Failed to update employee."
        )
      );
  } finally {
  }
};

exports.getFullEmployee = async (req, res) => {
  try {
    const employeeId = req.params.employeeId;
    const orgId =
      resolveOrgIdFromReq(req) || (req.user && req.user.orgId) || null;
    if (!orgId) {
      return res
        .status(400)
        .json(
          ErrorHandler.generateErrorResponse(400, "Missing x-org-id header")
        );
    }
    const profile = await employeeService.getFullEmployee(employeeId, orgId);

    return res
      .status(200)
      .json(
        ErrorHandler.generateSuccessResponse(200, "Employee fetched.", profile)
      );
  } catch (err) {
    console.error("getFullEmployee error:", err);
    return res
      .status(404)
      .json(
        ErrorHandler.generateErrorResponse(
          404,
          err.message || "Employee not found."
        )
      );
  }
};

exports.searchEmployees = async (req, res) => {
  try {
    const { search, fromDate, toDate } = req.query;

    const orgId = req.headers["x-org-id"] || req.query.orgId;

    const employees = await employeeService.searchEmployees(
      search,
      fromDate,
      toDate,
      orgId
    );

    return res
      .status(200)
      .json(ErrorHandler.generateSuccessResponse(200, { data: employees }));
  } catch (error) {
    console.error("Error fetching employees:", error);

    return res
      .status(500)
      .json(
        ErrorHandler.generateErrorResponse(500, "Failed to fetch employees")
      );
  }
};

const BASE_UPLOADS = path.join(__dirname, "../../../EmployeeDetails");

exports.serveEmployeeFile = async (req, res) => {
  try {
    const relativePath = req.params[0];

    const sanitizedPath = relativePath.replace(/\.\./g, "");

    const fullPath = path.join(
      BASE_UPLOADS,
      sanitizedPath.replace(/^EmployeeDetails[\\/]/, "")
    );

    if (!fs.existsSync(fullPath)) {
      console.warn("[serveEmployeeFile] file does not exist:", fullPath);
      return res
        .status(404)
        .json({ status: "error", message: "File not found" });
    }

    return res.sendFile(fullPath);
  } catch (err) {
    console.error("[serveEmployeeFile] error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Failed to serve file." });
  }
};

exports.deactivateEmployee = async (req, res) => {
  try {
    const employeeId = req.params.employeeId;
    const orgId =
      resolveOrgIdFromReq(req) || (req.user && req.user.orgId) || null;
    if (!orgId) {
      return res
        .status(400)
        .json(
          ErrorHandler.generateErrorResponse(400, "Missing x-org-id header")
        );
    }
    await employeeService.deactivateEmployee(employeeId, orgId);

    return res
      .status(200)
      .json(
        ErrorHandler.generateSuccessResponse(
          200,
          "Employee deactivated successfully"
        )
      );
  } catch (error) {
    return res
      .status(400)
      .json(
        ErrorHandler.generateErrorResponse(400, "Failed to deactivate employee")
      );
  }
};

exports.listUserRoles = async (req, res) => {
  try {
    const roles = await employeeService.getUserRoles();
    return res.status(200).json({ status: "success", data: roles });
  } catch (err) {
    console.error("listUserRoles error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Failed to fetch roles" });
  }
};

exports.listPositions = async (req, res) => {
  try {
    const { role } = req.query;
    const positions = await employeeService.getPositions(role);
    return res.status(200).json({ status: "success", data: positions });
  } catch (err) {
    console.error("listPositions error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Failed to fetch positions" });
  }
};

exports.listSupervisorsByPosition = async (req, res) => {
  try {
    const { position, department_id } = req.query;
    const orgId = req.headers["x-org-id"] || req.query.orgId;
    const supervisors = await employeeService.getSupervisorsByPosition(
      position,
      department_id,
      orgId
    );
    return res.status(200).json({ status: "success", data: supervisors });
  } catch (err) {
    console.error("listSupervisorsByPosition error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Failed to fetch supervisors" });
  }
};

exports.assignSupervisor = async (req, res, next) => {
  try {
    const { employeeId, supervisorId, startDate } = req.body;
    if (!employeeId || !supervisorId || !startDate) {
      return res
        .status(400)
        .json(
          ErrorHandler.generateErrorResponse(
            400,
            "employeeId, supervisorId and startDate are required."
          )
        );
    }
    const orgId =
      resolveOrgIdFromReq(req) || (req.user && req.user.orgId) || null;
    if (!orgId) {
      return res
        .status(400)
        .json(
          ErrorHandler.generateErrorResponse(400, "Missing x-org-id header")
        );
    }
    const result = await employeeService.assignSupervisor(
      employeeId,
      supervisorId,
      startDate,
      orgId
    );

    return res.json(
      ErrorHandler.generateSuccessResponse(200, "Supervisor assigned.", result)
    );
  } catch (err) {
    next(err);
  }
};

exports.getSupervisorHistory = async (req, res, next) => {
  try {
    const employeeId = req.params.employeeId;
    const orgId =
      resolveOrgIdFromReq(req) || (req.user && req.user.orgId) || null;
    if (!orgId) {
      return res
        .status(400)
        .json(
          ErrorHandler.generateErrorResponse(400, "Missing x-org-id header")
        );
    }
    const history = await employeeService.getSupervisorHistory(
      employeeId,
      orgId
    );

    return res.json(
      ErrorHandler.generateSuccessResponse(200, "History fetched.", { history })
    );
  } catch (err) {
    next(err);
  }
};
