const multer = require("multer");
const path = require("path");
const fs = require("fs");
const upload = require("../utils/multerConfig");
const employeeService = require("../services/employeeService");
const ErrorHandler = require("../utils/errorHandler");
const xlsx = require("xlsx");
const db = require("../config");
const queries = require("../constants/empDetailsQueries");

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
  } else {
    console.log("[bulkAddEmployees] orgId:", orgId);
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
    console.log("[bulkAddEmployees] parsed rows:", employeesData.length);

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
  console.log("[createFullEmployee] ⇒ start");
  try {
    const data = { ...req.body };
    const raw = req.body || {};

    // Resolve orgId from header/body/query and normalize onto data
    const orgId = resolveOrgIdFromReq(req);
    if (orgId) {
      // normalize to your preferred key; using org_id
      data.org_id = data.org_id || data.orgId || orgId;
      data.orgId = data.orgId || data.org_id || orgId;
      console.log("[createFullEmployee] orgId resolved:", data.org_id);
    } else {
      console.warn("[createFullEmployee] orgId not provided in request");
    }

    let additionalCerts = [];
    if (raw.additional_certs) {
      try {
        additionalCerts =
          typeof raw.additional_certs === "string"
            ? JSON.parse(raw.additional_certs)
            : raw.additional_certs;
      } catch (e) {
        additionalCerts = [];
      }
    }

    for (let key of Object.keys(raw)) {
      const m = key.match(
        /^additional_certs\[(\d+)\]\[(name|year|institution)\]$/
      );
      if (!m) continue;
      const idx = Number(m[1]);
      const field = m[2];
      additionalCerts[idx] = additionalCerts[idx] || {};
      additionalCerts[idx][field] = raw[key];
    }
    data.additional_certs = (additionalCerts || []).filter(Boolean);

    let expList = [];
    if (raw.experience) {
      try {
        expList =
          typeof raw.experience === "string"
            ? JSON.parse(raw.experience)
            : raw.experience;
      } catch (e) {
        expList = [];
      }
    }
    for (let key of Object.keys(raw)) {
      const m = key.match(
        /^experience\[(\d+)\]\[(company|role|start_date|end_date)\]$/
      );
      if (!m) continue;
      const idx = Number(m[1]);
      const field = m[2];
      expList[idx] = expList[idx] || {};
      expList[idx][field] = raw[key];
    }
    data.experience = (expList || []).filter(Boolean);

    const [emailRows] = await db.execute(queries.CHECK_EMAIL, [data.email]);
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

    const [persRows] = await db.execute(queries.CHECK_PERSONAL_DUP, [
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

    let filesByField = {};
    if (Array.isArray(req.files)) {
      for (let f of req.files) {
        filesByField[f.fieldname] = filesByField[f.fieldname] || [];
        filesByField[f.fieldname].push(f);
      }
    } else if (typeof req.files === "object") {
      for (let [fieldname, fileArray] of Object.entries(req.files)) {
        filesByField[fieldname] = fileArray;
      }
    }

    const simpleMap = {
      photo: "photo_url",
      aadhaar_doc: "aadhaar_doc_url",
      pan_doc: "pan_doc_url",
      passport_doc: "passport_doc_url",
      driving_license_doc: "driving_license_doc_url",
      voter_id_doc: "voter_id_doc_url",
      tenth_cert: "tenth_cert_url",
      twelfth_cert: "twelfth_cert_url",
      ug_cert: "ug_cert_url",
      pg_cert: "pg_cert_url",
      resume: "resume_url",
      other_docs: "other_docs_urls",
    };

    for (let [field, dataKey] of Object.entries(simpleMap)) {
      const files = filesByField[field] || [];
      if (!files.length) continue;
      data[dataKey] = files.map((f) => getWebPath(f.path));
    }

    if (Array.isArray(data.additional_certs)) {
      data.additional_certs = data.additional_certs.map((cert, idx) => {
        const key = `additional_certs[${idx}][file]`;
        const files = filesByField[key] || [];
        cert.file_urls = files.map((f) => getWebPath(f.path));
        return cert;
      });
    }

    if (Array.isArray(data.experience)) {
      data.experience = data.experience.map((exp, idx) => {
        const key = `experience[${idx}][doc]`;
        const files = filesByField[key] || [];
        exp.doc_urls = files.map((f) => getWebPath(f.path));
        return exp;
      });
    }

    for (let side of [
      "father",
      "mother",
      "spouse",
      "child1",
      "child2",
      "child3",
    ]) {
      const field = `${side}_gov_doc`;
      const urlKey = `${side}_gov_doc_url`;
      const files = filesByField[field] || [];
      if (files.length) data[urlKey] = files.map((f) => getWebPath(f.path));
    }

    console.log("[createFullEmployee] calling service.addFullEmployee");
    let employee_id;
    try {
      const resObj = await employeeService.addFullEmployee(data);
      employee_id = resObj && resObj.employee_id;
      console.log("[createFullEmployee] ⇒ success", employee_id);
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
      console.log(
        "[createFullEmployee] attempting to send reset email to:",
        data.email
      );
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
        console.log("[createFullEmployee] reset email sent");
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
    console.log("[createFullEmployee] ⇒ end");
  }
};

exports.updateFullEmployee = async (req, res) => {
  console.log("[updateFullEmployee] ⇒ start");
  try {
    const raw = req.body || {};
    const data = { employee_id: req.params.employeeId, ...raw };

    // resolve orgId and normalize onto data
    const orgId = resolveOrgIdFromReq(req);
    if (orgId) {
      data.org_id = data.org_id || data.orgId || orgId;
      data.orgId = data.orgId || data.org_id || orgId;
      console.log("[updateFullEmployee] orgId resolved:", data.org_id);
    } else {
      console.warn("[updateFullEmployee] orgId not provided in request");
    }

    console.log(
      "[updateFullEmployee] incoming raw body keys:",
      Object.keys(raw)
    );
    console.log("👉 RAW req.files:", JSON.stringify(req.files || {}, null, 2));

    [
      "dob",
      "father_dob",
      "mother_dob",
      "spouse_dob",
      "child1_dob",
      "child2_dob",
      "child3_dob",
      "marriage_date",
      "joining_date",
    ].forEach((k) => {
      if (data[k] && typeof data[k] === "string" && data[k].includes("T")) {
        data[k] = data[k].split("T")[0];
      }
    });

    const hasKey = (k) => Object.prototype.hasOwnProperty.call(raw, k);

    const [emailRows] = await db.execute(queries.CHECK_EMAIL_UPDATE, [
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

    const [persRows] = await db.execute(queries.CHECK_PERSONAL_DUP_UPDATE, [
      data.aadhaar_number,
      data.pan_number,
      data.employee_id,
    ]);
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

    let filesByField = {};
    if (Array.isArray(req.files)) {
      for (let f of req.files) {
        filesByField[f.fieldname] = filesByField[f.fieldname] || [];
        filesByField[f.fieldname].push(f);
      }
    } else if (typeof req.files === "object" && req.files !== null) {
      for (let [field, arr] of Object.entries(req.files)) {
        filesByField[field] = arr;
      }
    }
    console.log(
      "[updateFullEmployee] filesByField keys:",
      Object.keys(filesByField)
    );

    const simpleMap = {
      photo: "photo_url",
      aadhaar_doc: "aadhaar_doc_url",
      pan_doc: "pan_doc_url",
      passport_doc: "passport_doc_url",
      driving_license_doc: "driving_license_doc_url",
      voter_id_doc: "voter_id_doc_url",
      tenth_cert: "tenth_cert_url",
      twelfth_cert: "twelfth_cert_url",
      ug_cert: "ug_cert_url",
      pg_cert: "pg_cert_url",
      resume: "resume_url",
      other_docs: "other_docs_urls",
    };

    for (let [field, dataKey] of Object.entries(simpleMap)) {
      const files = filesByField[field] || [];
      if (files.length) {
        data[dataKey] = files.map((f) => getWebPath(f.path));
      } else if (hasKey(dataKey)) {
        data[dataKey] = raw[dataKey];
      } else {
        delete data[dataKey];
      }
    }

    if (hasKey("additional_certs")) {
      let additionalCerts = [];
      if (raw.additional_certs) {
        try {
          additionalCerts =
            typeof raw.additional_certs === "string"
              ? JSON.parse(raw.additional_certs)
              : raw.additional_certs;
        } catch (e) {
          additionalCerts = [];
        }
      }
      for (let key of Object.keys(raw)) {
        const m = key.match(
          /^additional_certs\[(\d+)\]\[(name|year|institution)\]$/
        );
        if (!m) continue;
        const idx = Number(m[1]);
        const field = m[2];
        additionalCerts[idx] = additionalCerts[idx] || {};
        additionalCerts[idx][field] = raw[key];
      }
      data.additional_certs = (additionalCerts || []).map((cert, idx) => {
        const key = `additional_certs[${idx}][file]`;
        const files = filesByField[key] || [];
        if (files.length) cert.file_urls = files.map((f) => getWebPath(f.path));
        return cert;
      });
    } else {
      delete data.additional_certs;
    }

    if (hasKey("experience")) {
      let expList = [];
      if (raw.experience) {
        try {
          expList =
            typeof raw.experience === "string"
              ? JSON.parse(raw.experience)
              : raw.experience;
        } catch (e) {
          expList = [];
        }
      }
      for (let key of Object.keys(raw)) {
        const m = key.match(
          /^experience\[(\d+)\]\[(company|role|start_date|end_date)\]$/
        );
        if (!m) continue;
        const idx = Number(m[1]);
        const field = m[2];
        expList[idx] = expList[idx] || {};
        expList[idx][field] = raw[key];
      }
      data.experience = (expList || []).map((exp, idx) => {
        const key = `experience[${idx}][doc]`;
        const files = filesByField[key] || [];
        if (files.length) exp.doc_urls = files.map((f) => getWebPath(f.path));
        return exp;
      });
    } else {
      delete data.experience;
    }

    for (let side of [
      "father",
      "mother",
      "spouse",
      "child1",
      "child2",
      "child3",
    ]) {
      const field = `${side}_gov_doc`;
      const urlKey = `${side}_gov_doc_url`;
      const files = filesByField[field] || [];
      if (files.length) {
        data[urlKey] = files.map((f) => getWebPath(f.path));
      } else if (hasKey(urlKey)) {
        data[urlKey] = raw[urlKey];
      } else {
        delete data[urlKey];
      }
    }

    console.log(
      "[updateFullEmployee] final data keys to pass to service:",
      Object.keys(data)
    );

    console.log("[updateFullEmployee] calling service.editFullEmployee");
    await employeeService.editFullEmployee(data);

    console.log("[updateFullEmployee] ⇒ success");
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
    console.log("[updateFullEmployee] ⇒ end");
  }
};

exports.getFullEmployee = async (req, res) => {
  try {
    const employeeId = req.params.employeeId;
    const profile = await employeeService.getFullEmployee(employeeId);
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
    console.log("[serveEmployeeFile] relativePath:", relativePath);

    const sanitizedPath = relativePath.replace(/\.\./g, "");
    console.log("[serveEmployeeFile] sanitizedPath:", sanitizedPath);

    const fullPath = path.join(
      BASE_UPLOADS,
      sanitizedPath.replace(/^EmployeeDetails[\\/]/, "")
    );
    console.log("[serveEmployeeFile] fullPath:", fullPath);

    if (!fs.existsSync(fullPath)) {
      console.warn("[serveEmployeeFile] file does not exist:", fullPath);
      return res
        .status(404)
        .json({ status: "error", message: "File not found" });
    }

    console.log("[serveEmployeeFile] sending file:", fullPath);
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
    await employeeService.deactivateEmployee(employeeId);
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
    const { role, department_id } = req.query;
    const positions = await employeeService.getPositions(role, department_id);
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
    const supervisors = await employeeService.getSupervisorsByPosition(
      position,
      department_id
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
    const result = await employeeService.assignSupervisor(
      employeeId,
      supervisorId,
      startDate
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
    const history = await employeeService.getSupervisorHistory(employeeId);
    return res.json(
      ErrorHandler.generateSuccessResponse(200, "History fetched.", { history })
    );
  } catch (err) {
    next(err);
  }
};
