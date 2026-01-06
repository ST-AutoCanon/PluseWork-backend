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

const mapUploadedFilesToData = (req, data) => {
  if (!req.files) return;

  // multer({}).any() yields an array of files; normalize to an object keyed by fieldname
  const filesByField = Array.isArray(req.files)
    ? req.files.reduce((acc, f) => {
        // normalize base fieldname: remove trailing [] and patterns like [0][file]
        const raw = String(f.fieldname || "");
        const base = raw
          .replace(/\[\]$/, "")
          .replace(/\[\d+\]\[(?:doc|file)\]$/, "");
        // always push into the canonical base key once
        acc[base] = acc[base] || [];
        acc[base].push(f);
        // keep original fieldname mapping only if different from base
        if (raw !== base) {
          acc[raw] = acc[raw] || [];
          acc[raw].push(f);
        }
        return acc;
      }, {})
    : req.files;

  // Handle bracketed fields like additional_certs[0][file] and experience[0][doc]
  if (Array.isArray(req.files)) {
    for (const f of req.files) {
      try {
        const bm = String(f.fieldname || "").match(
          /^(experience|additional_certs)\[(\d+)\]\[(doc|file)\]$/
        );
        if (bm) {
          const type = bm[1];
          const idx = Number(bm[2]);
          const web = getWebPath(f.path);
          if (!Array.isArray(data[type])) data[type] = [];
          if (!data[type][idx]) data[type][idx] = {};
          if (type === "experience") {
            data[type][idx].doc_urls = data[type][idx].doc_urls || [];
            data[type][idx].doc_urls.push(web);
          } else if (type === "additional_certs") {
            data[type][idx].file_urls = data[type][idx].file_urls || [];
            data[type][idx].file_urls.push(web);
          }
        }
      } catch (e) {
        console.warn(
          "[mapUploadedFilesToData] bracket mapping failed",
          e && e.message
        );
      }
    }
  }

  const single = (key) =>
    filesByField[key]?.[0] ? getWebPath(filesByField[key][0].path) : null;

  const multiple = (key) => {
    const arr = filesByField[key];
    if (!arr || !arr.length) return null;
    // map to web paths and dedupe
    const mapped = arr.map((f) => getWebPath(f.path));
    return Array.from(new Set(mapped));
  };

  data.photo_url = multiple("photo") || data.photo_url;
  data.aadhaar_doc_url = multiple("aadhaar_doc") || data.aadhaar_doc_url;
  data.pan_doc_url = multiple("pan_doc") || data.pan_doc_url;
  data.passport_doc_url = multiple("passport_doc") || data.passport_doc_url;
  data.driving_license_doc_url =
    multiple("driving_license_doc") || data.driving_license_doc_url;
  data.voter_id_doc_url = multiple("voter_id_doc") || data.voter_id_doc_url;

  data.spouse_gov_doc_url =
    multiple("spouse_gov_doc") || data.spouse_gov_doc_url;
  data.father_gov_doc_url =
    multiple("father_gov_doc") || data.father_gov_doc_url;
  data.mother_gov_doc_url =
    multiple("mother_gov_doc") || data.mother_gov_doc_url;
  data.child1_gov_doc_url =
    multiple("child1_gov_doc") || data.child1_gov_doc_url;
  data.child2_gov_doc_url =
    multiple("child2_gov_doc") || data.child2_gov_doc_url;
  data.child3_gov_doc_url =
    multiple("child3_gov_doc") || data.child3_gov_doc_url;

  data.resume_url = multiple("resume") || data.resume_url;
  data.other_docs_urls = multiple("other_docs") || data.other_docs_urls;

  // Generic mapping: for any uploaded field not explicitly handled above,
  // try to set a sensible data property (e.g. `tenth_cert` -> `tenth_cert_url`).
  try {
    console.debug(
      "[mapUploadedFilesToData] filesByField keys:",
      Object.keys(filesByField)
    );
    for (const rawKey of Object.keys(filesByField)) {
      const baseKey = String(rawKey)
        .replace(/\[\]$/, "")
        .replace(/\[\d+\]\[(?:doc|file)\]$/, "");
      const arr = multiple(rawKey);
      if (!arr || !arr.length) continue;

      const candidateKeys = [];
      if (baseKey === "other_docs") candidateKeys.push("other_docs_urls");
      if (baseKey === "resume") candidateKeys.push("resume_url");
      if (baseKey === "photo") candidateKeys.push("photo_url");
      candidateKeys.push(
        `${baseKey}_url`,
        `${baseKey}_doc_url`,
        `${baseKey}_cert_url`,
        baseKey
      );

      for (const ck of candidateKeys) {
        if (!ck) continue;
        // treat undefined, null, empty-array or empty-string as empty and allow overwrite
        const cur = data[ck];
        const isEmptyString = typeof cur === "string" && cur.trim() === "";
        if (
          cur === undefined ||
          cur === null ||
          isEmptyString ||
          (Array.isArray(cur) && cur.length === 0)
        ) {
          data[ck] = arr;
          break;
        }
      }
    }
    console.debug("[mapUploadedFilesToData] mapped data file fields", {
      photo_url: data.photo_url,
      resume_url: data.resume_url,
      other_docs_urls: data.other_docs_urls,
    });
  } catch (e) {
    console.warn("[mapUploadedFilesToData] mapping error", e && e.message);
  }
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

    mapUploadedFilesToData(req, data);

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

    mapUploadedFilesToData(req, data);

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
    const orgId = req.headers["x-org-id"] || req.query.orgId;
    const positions = await employeeService.getPositions(role, orgId);
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
