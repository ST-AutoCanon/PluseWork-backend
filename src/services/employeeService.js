const db = require("../config");
const queries = require("../constants/empDetailsQueries");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const { sendResetEmail } = require("../utils/brevoMailer");

const BASE_UPLOADS = path.join(__dirname, "../../../EmployeeDetails");

function tryParseJSON(val) {
  if (val == null) return val;
  if (typeof val !== "string") return val;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

function normalizeToStringArray(input) {
  if (input == null) return [];

  if (Array.isArray(input)) {
    const out = [];
    for (const item of input) {
      const nested = normalizeToStringArray(item);
      for (const v of nested) if (v) out.push(v);
    }
    return Array.from(new Set(out));
  }

  if (typeof input === "object") {
    try {
      return normalizeToStringArray(JSON.stringify(input));
    } catch {
      return [];
    }
  }

  const s = String(input).trim();
  if (!s) return [];

  if (s.startsWith("[") && s.endsWith("]")) {
    try {
      const parsed = JSON.parse(s);
      return normalizeToStringArray(parsed);
    } catch {}
  }

  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    try {
      const parsed = JSON.parse(s);
      return normalizeToStringArray(parsed);
    } catch {}
  }

  if (s.includes(",")) {
    const parts = s
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    return normalizeToStringArray(parts);
  }

  return [s];
}

function arrayToJsonOrNull(val) {
  const arr = normalizeToStringArray(val);
  if (!arr || !arr.length) return null;
  return JSON.stringify(arr);
}

function ensureArrayField(raw) {
  return normalizeToStringArray(raw);
}

function webUrlToFullPath(webUrl) {
  if (!webUrl) return null;
  const clean = String(webUrl).split("?")[0];
  const rel = clean.replace(/^\/?EmployeeDetails[\\/]/, "");
  return path.join(BASE_UPLOADS, rel);
}

function deleteFilesByUrlsMixed(val) {
  const arr = normalizeToStringArray(val);
  for (const url of arr) {
    try {
      const full = webUrlToFullPath(url);
      if (full && fs.existsSync(full)) {
        fs.unlinkSync(full);
        console.log("[file-delete] removed:", full);
      } else {
      }
    } catch (e) {
      console.warn(
        "[file-delete] failed for",
        url,
        e && e.message ? e.message : e
      );
    }
  }
}

function normalizeOrgId(data) {
  if (!data) return null;
  const val =
    data.org_id ||
    data.orgId ||
    data.organization_id ||
    data.organizationId ||
    null;
  if (val) {
    data.org_id = String(val);
    data.orgId = String(val);
    data.organization_id = String(val);
  }
  return data.org_id || null;
}

const PAD_DIGITS = 6;

async function addFullEmployeeUsingConnection(conn, data, options = {}) {
  const resolvedOrg = data.org_id || data.orgId || data.organization_id || null;
  if (!resolvedOrg) throw new Error("org_id required for employee creation");

  const [orgRows] = await conn.execute(queries.SELECT_ORG_FOR_UPDATE, [
    resolvedOrg,
  ]);
  const org = orgRows && orgRows[0] ? orgRows[0] : null;
  if (!org) throw new Error("Organization not found");

  if (org.no_employees != null && !options.bypassOrgLimit) {
    const [countRows] = await conn.execute(
      queries.COUNT_ACTIVE_EMPLOYEES_BY_ORG,
      [resolvedOrg]
    );
    const current = Number(countRows && countRows[0] ? countRows[0].cnt : 0);
    const allowed = Number(org.no_employees);
    if (!Number.isNaN(allowed) && current >= allowed) {
      throw new Error(
        `Employee limit reached for organization (allowed: ${allowed}, current: ${current}).`
      );
    }
  }

  const newCounter = Number(org.employee_counter || 0) + 1;
  await conn.execute(queries.UPDATE_ORG_COUNTER, [newCounter, resolvedOrg]);

  const suffix = newCounter;
  const suffixStr = String(suffix).padStart(PAD_DIGITS, "0");
  const prefix = (org.employee_prefix || "").toUpperCase();
  if (!prefix) {
    throw new Error(
      "Organization employee_prefix missing; cannot generate employee_id"
    );
  }
  const employeeId = `${prefix}-${suffixStr}`;

  const password = crypto.randomBytes(8).toString("hex");
  const hash = await bcrypt.hash(password, 10);

  const coreParams = [
    employeeId,
    suffix,
    data.first_name,
    data.last_name,
    data.email,
    hash,
    data.phone_number || null,
    data.dob || null,
    resolvedOrg,
  ];

  await conn.execute(queries.ADD_EMPLOYEE_CORE, coreParams);

  const eid = employeeId;

  const personalFileKeys = [
    "spouse_gov_doc_url",
    "aadhaar_doc_url",
    "pan_doc_url",
    "passport_doc_url",
    "driving_license_doc_url",
    "voter_id_doc_url",
    "father_gov_doc_url",
    "mother_gov_doc_url",
    "child1_gov_doc_url",
    "child2_gov_doc_url",
    "child3_gov_doc_url",
    "photo_url",
  ];

  function normalizeToStringArray(input) {
    if (input == null) return [];
    if (Array.isArray(input)) return input;
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return [String(input)];
  }
  function arrayToJsonOrNull(val) {
    const arr = normalizeToStringArray(val);
    if (!arr || !arr.length) return null;
    return JSON.stringify(arr);
  }

  const personalParams = [
    eid,
    data.address || null,
    data.father_name || null,
    data.mother_name || null,
    data.gender || null,
    data.marital_status || null,
    data.spouse_name || null,
    data.spouse_dob || null,
    arrayToJsonOrNull(data.spouse_gov_doc_url || null),
    data.marriage_date || null,
    data.aadhaar_number || null,
    arrayToJsonOrNull(data.aadhaar_doc_url || null),
    data.pan_number || null,
    arrayToJsonOrNull(data.pan_doc_url || null),
    data.passport_number || null,
    arrayToJsonOrNull(data.passport_doc_url || null),
    data.driving_license_number || null,
    arrayToJsonOrNull(data.driving_license_doc_url || null),
    data.voter_id || null,
    arrayToJsonOrNull(data.voter_id_doc_url || null),
    data.uan_number || null,
    data.pf_number || null,
    data.esi_number || null,
    arrayToJsonOrNull(data.photo_url || null),
    data.alternate_email || null,
    data.alternate_number || null,
    data.blood_group || null,
    data.emergency_name || null,
    data.emergency_number || null,
    data.father_dob || null,
    arrayToJsonOrNull(data.father_gov_doc_url || null),
    data.mother_dob || null,
    arrayToJsonOrNull(data.mother_gov_doc_url || null),
    data.child1_name || null,
    data.child1_dob || null,
    arrayToJsonOrNull(data.child1_gov_doc_url || null),
    data.child2_name || null,
    data.child2_dob || null,
    arrayToJsonOrNull(data.child2_gov_doc_url || null),
    data.child3_name || null,
    data.child3_dob || null,
    arrayToJsonOrNull(data.child3_gov_doc_url || null),
  ];
  await conn.execute(queries.ADD_EMPLOYEE_PERSONAL, personalParams);

  await conn.execute(queries.ADD_EMPLOYEE_EDU, [
    eid,
    data.tenth_institution || null,
    data.tenth_year || null,
    data.tenth_board || null,
    data.tenth_score || null,
    arrayToJsonOrNull(
      data.tenth_cert_url || data.tenth_cert || data.tenth_cert_urls
    ),
    data.twelfth_institution || null,
    data.twelfth_year || null,
    data.twelfth_board || null,
    data.twelfth_score || null,
    arrayToJsonOrNull(
      data.twelfth_cert_url || data.twelfth_cert || data.twelfth_cert_urls
    ),
    data.ug_institution || null,
    data.ug_year || null,
    data.ug_board || null,
    data.ug_score || null,
    arrayToJsonOrNull(data.ug_cert_url || data.ug_cert || data.ug_cert_urls),
    data.pg_institution || null,
    data.pg_year || null,
    data.pg_board || null,
    data.pg_score || null,
    arrayToJsonOrNull(data.pg_cert_url || data.pg_cert || data.pg_cert_urls),
  ]);

  if (Array.isArray(data.additional_certs)) {
    for (let cert of data.additional_certs) {
      const fileUrls = cert.file_urls || cert.files || cert.file || null;
      await conn.execute(queries.ADD_EMPLOYEE_ADDITIONAL_CERT, [
        eid,
        cert.name || null,
        cert.institution || null,
        cert.year || null,
        arrayToJsonOrNull(fileUrls),
      ]);
    }
  }

  await conn.execute(queries.ADD_EMPLOYEE_PRO, [
    eid,
    data.domain || null,
    data.employee_type || null,
    data.joining_date || null,
    data.role || null,
    data.department_id || null,
    data.position || null,
    data.supervisor_id || null,
    data.salary || null,
    arrayToJsonOrNull(data.resume_url || data.resume || data.resume_urls),
  ]);

  const otherDocsRaw = data.other_docs_urls || data.other_docs || null;
  const otherDocs = normalizeToStringArray(otherDocsRaw);
  if (otherDocs.length) {
    for (const url of otherDocs) {
      await conn.execute(queries.ADD_EMPLOYEE_OTHER_DOC, [eid, url]);
    }
  }

  const fullName = `${data.first_name} ${data.last_name}`.trim();
  await conn.execute(queries.ADD_EMPLOYEE_BANK, [
    eid,
    fullName,
    data.bank_name || null,
    data.account_number || null,
    data.ifsc_code || null,
    data.branch_name || null,
  ]);

  if (Array.isArray(data.experience)) {
    for (let exp of data.experience) {
      const docUrls = exp.doc_urls || exp.files || exp.doc || null;
      await conn.execute(queries.ADD_EMPLOYEE_EXP, [
        eid,
        exp.company || null,
        exp.role || null,
        exp.start_date || null,
        exp.end_date || null,
        arrayToJsonOrNull(docUrls),
      ]);
    }
  }

  return { employee_id: eid, tempPassword: password };
}

exports.addFullEmployee = async (data, options = {}) => {
  const requiredFields = [
    "first_name",
    "last_name",
    "email",
    "phone_number",
    "dob",
    "role",
    "aadhaar_number",
    "pan_number",
  ];

  const missing = requiredFields.filter(
    (f) => !data[f] || String(data[f]).trim() === ""
  );

  if (!data.org_id || String(data.org_id).trim() === "") {
    missing.push("org_id");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const res = await addFullEmployeeUsingConnection(conn, data, options);
    await conn.commit();

    try {
      const mailRes = await sendResetEmail(
        data.email,
        `${data.first_name} ${data.last_name}`
      );
      if (mailRes && mailRes.resetToken) {
        await conn.execute(queries.SAVE_RESET_TOKEN, [
          data.email,
          mailRes.resetToken,
          mailRes.tokenExpiry,
        ]);
      }
    } catch (mailErr) {
      console.warn(
        "[addFullEmployee] reset-email failed (not rolled back):",
        mailErr
      );
    }

    return { employee_id: res.employee_id };
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rb) {
      console.error("rollback failed", rb);
    }
    throw err;
  } finally {
    try {
      conn.release();
    } catch (e) {}
  }
};

exports.editFullEmployee = async (data) => {
  console.log("[editFullEmployee] ⇒ start", { employee_id: data.employee_id });
  console.log("[editFullEmployee] ⇒ start", data);
  normalizeOrgId(data);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    console.log("[editFullEmployee] began transaction");

    const eid = data.employee_id;

    const [existingRows] = await conn.execute(queries.GET_FULL_EMPLOYEE, [eid]);
    const existing = existingRows && existingRows[0] ? existingRows[0] : {};
    console.log("[editFullEmployee] loaded existing row for fallback");

    const hasKey = (k) => Object.prototype.hasOwnProperty.call(data, k);

    if (hasKey("resume_url") && typeof data.resume_url === "string") {
      const parsed = tryParseJSON(data.resume_url);
      if (Array.isArray(parsed)) data.resume_url = parsed;
    }
    if (
      hasKey("additional_certs") &&
      typeof data.additional_certs === "string"
    ) {
      const parsed = tryParseJSON(data.additional_certs);
      if (Array.isArray(parsed)) data.additional_certs = parsed;
    }
    if (hasKey("experience") && typeof data.experience === "string") {
      const parsed = tryParseJSON(data.experience);
      if (Array.isArray(parsed)) data.experience = parsed;
    }

    const pick = (key) => (hasKey(key) ? data[key] : existing[key]);

    const personalFileFields = [
      "spouse_gov_doc_url",
      "aadhaar_doc_url",
      "pan_doc_url",
      "passport_doc_url",
      "driving_license_doc_url",
      "voter_id_doc_url",
      "photo_url",
      "father_gov_doc_url",
      "mother_gov_doc_url",
      "child1_gov_doc_url",
      "child2_gov_doc_url",
      "child3_gov_doc_url",
    ];

    for (const field of personalFileFields) {
      if (hasKey(field)) {
        deleteFilesByUrlsMixed(existing[field]);
      }
    }

    if (hasKey("resume_url") || hasKey("resume") || hasKey("resume_urls")) {
      deleteFilesByUrlsMixed(existing.resume_url);
    }

    if (hasKey("other_docs") || hasKey("other_docs_urls")) {
      deleteFilesByUrlsMixed(existing.other_docs);
    }

    if (hasKey("additional_certs")) {
      try {
        const oldAdditional = tryParseJSON(existing.additional_certs) || [];
        if (Array.isArray(oldAdditional) && oldAdditional.length) {
          for (const cert of oldAdditional) {
            deleteFilesByUrlsMixed(
              cert && (cert.file_urls || cert.files || cert.file)
            );
          }
        }
      } catch (e) {
        console.warn(
          "[editFullEmployee] could not parse existing.additional_certs",
          e
        );
      }
    }

    if (hasKey("experience")) {
      try {
        const oldExp = tryParseJSON(existing.experience) || [];
        if (Array.isArray(oldExp) && oldExp.length) {
          for (const ex of oldExp) {
            deleteFilesByUrlsMixed(ex && (ex.doc_urls || ex.files || ex.doc));
          }
        }
      } catch (e) {
        console.warn(
          "[editFullEmployee] could not parse existing.experience",
          e
        );
      }
    }

    await conn.execute(queries.UPDATE_EMPLOYEE_CORE, [
      pick("first_name"),
      pick("last_name"),
      pick("email"),
      pick("phone_number"),
      pick("dob"),
      eid,
    ]);

    const personalKeys = [
      "address",
      "father_name",
      "mother_name",
      "gender",
      "marital_status",
      "spouse_name",
      "spouse_dob",
      "spouse_gov_doc_url",
      "marriage_date",
      "aadhaar_number",
      "aadhaar_doc_url",
      "pan_number",
      "pan_doc_url",
      "passport_number",
      "passport_doc_url",
      "driving_license_number",
      "driving_license_doc_url",
      "voter_id",
      "voter_id_doc_url",
      "uan_number",
      "pf_number",
      "esi_number",
      "photo_url",
      "alternate_email",
      "alternate_number",
      "blood_group",
      "emergency_name",
      "emergency_number",
      "father_dob",
      "father_gov_doc_url",
      "mother_dob",
      "mother_gov_doc_url",
      "child1_name",
      "child1_dob",
      "child1_gov_doc_url",
      "child2_name",
      "child2_dob",
      "child2_gov_doc_url",
      "child3_name",
      "child3_dob",
      "child3_gov_doc_url",
    ];

    const personalFileSet = new Set(personalFileFields);

    const personalParams = personalKeys.map((k) => {
      const val = pick(k);
      if (personalFileSet.has(k)) {
        return arrayToJsonOrNull(val);
      }
      return val !== undefined ? val : null;
    });
    personalParams.push(eid);
    await conn.execute(queries.UPDATE_EMPLOYEE_PERSONAL, personalParams);

    const resolveCertValue = (dbKey, altKeys = []) => {
      for (const k of [dbKey, ...altKeys]) {
        if (hasKey(k)) return data[k];
      }
      return existing[dbKey];
    };

    await conn.execute(queries.UPDATE_EMPLOYEE_EDU, [
      pick("tenth_institution") || null,
      pick("tenth_year") || null,
      pick("tenth_board") || null,
      pick("tenth_score") || null,
      arrayToJsonOrNull(
        resolveCertValue("tenth_cert_url", ["tenth_cert", "tenth_cert_urls"])
      ),
      pick("twelfth_institution") || null,
      pick("twelfth_year") || null,
      pick("twelfth_board") || null,
      pick("twelfth_score") || null,
      arrayToJsonOrNull(
        resolveCertValue("twelfth_cert_url", [
          "twelfth_cert",
          "twelfth_cert_urls",
        ])
      ),
      pick("ug_institution") || null,
      pick("ug_year") || null,
      pick("ug_board") || null,
      pick("ug_score") || null,
      arrayToJsonOrNull(
        resolveCertValue("ug_cert_url", ["ug_cert", "ug_cert_urls"])
      ),
      pick("pg_institution") || null,
      pick("pg_year") || null,
      pick("pg_board") || null,
      pick("pg_score") || null,
      arrayToJsonOrNull(
        resolveCertValue("pg_cert_url", ["pg_cert", "pg_cert_urls"])
      ),
      eid,
    ]);

    if (hasKey("additional_certs")) {
      await conn.execute(queries.DELETE_EMPLOYEE_ADDITIONAL_CERTS, [eid]);
      if (
        Array.isArray(data.additional_certs) &&
        data.additional_certs.length
      ) {
        for (let cert of data.additional_certs) {
          const fileUrls = cert.file_urls || cert.files || cert.file || null;
          await conn.execute(queries.ADD_EMPLOYEE_ADDITIONAL_CERT, [
            eid,
            cert.name || null,
            cert.institution || null,
            cert.year || null,
            arrayToJsonOrNull(fileUrls),
          ]);
        }
      }
    } else {
      console.log("[editFullEmployee] skipping additional_certs (no key)");
    }

    const chosenResume = (() => {
      if (hasKey("resume_url")) return data.resume_url;
      if (hasKey("resume")) return data.resume;
      if (hasKey("resume_urls")) return data.resume_urls;
      return existing.resume_url;
    })();

    await conn.execute(queries.UPDATE_EMPLOYEE_PRO, [
      pick("domain") || null,
      pick("employee_type") || null,
      pick("joining_date") || null,
      pick("role"),
      pick("department_id") || null,
      pick("position") || null,
      pick("supervisor_id") || null,
      pick("salary") || null,
      arrayToJsonOrNull(chosenResume),
      eid,
    ]);

    if (hasKey("other_docs") || hasKey("other_docs_urls")) {
      if (queries.DELETE_EMPLOYEE_OTHER_DOCS) {
        await conn.execute(queries.DELETE_EMPLOYEE_OTHER_DOCS, [eid]);
      }
      const otherDocsRaw = hasKey("other_docs_urls")
        ? data.other_docs_urls
        : hasKey("other_docs")
        ? data.other_docs
        : null;
      const otherDocs = ensureArrayField(otherDocsRaw);
      if (otherDocs.length) {
        for (const url of otherDocs) {
          await conn.execute(queries.ADD_EMPLOYEE_OTHER_DOC, [eid, url]);
        }
      }
    } else {
      console.log("[editFullEmployee] skipping other_docs (no key)");
    }

    const fullName = `${pick("first_name") || existing.first_name || ""} ${
      pick("last_name") || existing.last_name || ""
    }`.trim();
    await conn.execute(queries.UPDATE_EMPLOYEE_BANK, [
      fullName,
      pick("bank_name") || null,
      pick("account_number") || null,
      pick("ifsc_code") || null,
      pick("branch_name") || null,
      eid,
    ]);

    if (hasKey("experience")) {
      if (!queries.DELETE_EMPLOYEE_EXP)
        throw new Error("Missing SQL query: DELETE_EMPLOYEE_EXP");
      await conn.execute(queries.DELETE_EMPLOYEE_EXP, [eid]);

      const expList = Array.isArray(data.experience) ? data.experience : [];
      for (const exp of expList) {
        const docUrls = normalizeToStringArray(
          exp.doc_urls || exp.files || exp.doc || null
        );
        const hasAny =
          (exp.company && String(exp.company).trim()) ||
          (exp.role && String(exp.role).trim()) ||
          (exp.start_date && String(exp.start_date).trim()) ||
          (exp.end_date && String(exp.end_date).trim()) ||
          (Array.isArray(docUrls) && docUrls.length);
        if (!hasAny) continue;
        await conn.execute(queries.ADD_EMPLOYEE_EXP, [
          eid,
          exp.company || null,
          exp.role || null,
          exp.start_date || null,
          exp.end_date || null,
          arrayToJsonOrNull(docUrls),
        ]);
      }
    } else {
      console.log("[editFullEmployee] skipping experience (no key)");
    }

    await conn.commit();
    console.log("[editFullEmployee] committed");
  } catch (err) {
    await conn.rollback();
    console.error("[editFullEmployee] error:", err && (err.stack || err));
    throw err;
  } finally {
    try {
      conn.release();
    } catch (e) {
      console.warn("[editFullEmployee] connection release failed:", e);
    }
  }
};

exports.getFullEmployee = async (employeeId) => {
  const [rows] = await db.execute(queries.GET_FULL_EMPLOYEE, [employeeId]);
  if (!rows.length) throw new Error("Not found");
  const row = rows[0];

  row.additional_certs = tryParseJSON(row.additional_certs) || [];
  row.experience = tryParseJSON(row.experience) || [];

  const fileFields = [
    "tenth_cert_url",
    "twelfth_cert_url",
    "ug_cert_url",
    "pg_cert_url",
    "photo_url",
    "aadhaar_doc_url",
    "pan_doc_url",
    "passport_doc_url",
    "driving_license_doc_url",
    "voter_id_doc_url",
    "resume_url",
    "other_docs",
  ];

  for (const k of fileFields) {
    if (k in row) row[k] = ensureArrayField(row[k]);
  }

  if (Array.isArray(row.additional_certs)) {
    row.additional_certs = row.additional_certs.map((cert) => {
      if (!cert) return cert;
      cert.files = ensureArrayField(cert.files || cert.file_urls || cert.file);
      return cert;
    });
  }

  if (Array.isArray(row.experience)) {
    row.experience = row.experience.map((exp) => {
      if (!exp) return exp;
      exp.files = ensureArrayField(
        exp.files || exp.doc_url || exp.doc_urls || exp.doc
      );
      return exp;
    });
  }

  return row;
};

exports.searchEmployees = async (search, fromDate, toDate, orgId) => {
  try {
    let query = queries.GET_ALL_EMPLOYEES;
    let params = [];

    if (search) {
      query = queries.SEARCH_EMPLOYEES;
      params = [
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
      ];
    }

    function formatToMySQLDate(dateStr, isEndOfDay = false) {
      if (!dateStr) return null;
      const date = new Date(dateStr + "T00:00:00");
      if (isEndOfDay) date.setHours(23, 59, 59, 999);
      else date.setHours(0, 0, 0, 0);
      return date.toISOString().slice(0, 19).replace("T", " ");
    }

    const formattedFromDate = formatToMySQLDate(fromDate);
    const formattedToDate = formatToMySQLDate(toDate, true);

    if (orgId) {
      params.push(orgId);
    } else {
    }

    const dateClauses = [];
    if (formattedFromDate && formattedToDate) {
      dateClauses.push("pr.joining_date BETWEEN ? AND ?");
    } else if (formattedFromDate) {
      dateClauses.push("pr.joining_date >= ?");
    } else if (formattedToDate) {
      dateClauses.push("pr.joining_date <= ?");
    }

    if (formattedFromDate && formattedToDate) {
      params.push(formattedFromDate, formattedToDate);
    } else if (formattedFromDate) {
      params.push(formattedFromDate);
    } else if (formattedToDate) {
      params.push(formattedToDate);
    }

    if (dateClauses.length > 0) {
      const dateSql = " AND " + dateClauses.join(" AND ");
      const orderByIndex = query.toUpperCase().lastIndexOf("ORDER BY");
      if (orderByIndex !== -1) {
        query =
          query.slice(0, orderByIndex) +
          dateSql +
          " " +
          query.slice(orderByIndex);
      } else {
        query = query + dateSql;
      }
    }

    const [rows] = await db.execute(query, params);
    return rows;
  } catch (error) {
    console.error("❌ Error fetching employees from database:", error);
    throw new Error("Error fetching employees from database");
  }
};

exports.deactivateEmployee = async (employeeId) => {
  try {
    const [result] = await db.execute(queries.UPDATE_EMPLOYEE_STATUS, [
      employeeId,
    ]);

    if (result.affectedRows === 0) {
      throw new Error("Employee not found or already deactivated");
    }

    return { message: "Employee deactivated successfully" };
  } catch (error) {
    console.error("Error in deactivateEmployee:", error.message);
    throw error;
  }
};

exports.getEmployee = async (employeeId) => {
  try {
    const [rows] = await db.execute(queries.GET_EMPLOYEE, [employeeId]);

    if (rows.length === 0) {
      throw new Error("Employee not found");
    }

    return rows[0];
  } catch (error) {
    console.error("Error in getEmployee:", error.message);
    throw error;
  }
};

exports.getUserRoles = async () => {
  const [rows] = await db.execute(queries.GET_USER_ROLES);
  return rows;
};

exports.getPositions = async (role) => {
  const [rows] = await db.execute(queries.GET_POSITIONS_BY_ROLE_AND_DEPT, [
    role,
    role,
    role,
    role,
    role,
  ]);
  return rows.map((r) => r.name);
};

exports.getSupervisorsByPosition = async (position, department_id, orgId) => {
  const [rankRows] = await db.execute(queries.GET_POSITION_RANK, [position]);
  const currentRank = rankRows[0]?.rank;
  if (!currentRank) return [];

  const minRank = Math.max(1, currentRank - 3);
  const maxRank = currentRank - 1;
  if (minRank > maxRank) return [];

  const [rows] = await db.execute(queries.GET_SUPERVISORS_BY_POSITION, [
    department_id || null,
    minRank,
    maxRank,
    orgId,
  ]);

  return rows;
};

exports.assignSupervisor = async (employeeId, supervisorId, startDate) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(queries.UPDATE_SUPERVISOR_ASSIGNMENT_END, [
      startDate,
      employeeId,
    ]);
    const [addRes] = await conn.execute(queries.ADD_SUPERVISOR_ASSIGNMENT, [
      employeeId,
      supervisorId,
      startDate,
    ]);
    await conn.commit();
    return { assignment_id: addRes.insertId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

exports.getSupervisorHistory = async (employeeId) => {
  const [rows] = await db.execute(queries.GET_SUPERVISOR_HISTORY, [employeeId]);
  return rows;
};

exports.addFullEmployeeUsingConnection = addFullEmployeeUsingConnection;

async function sendResetEmailAndSave(email, name) {
  if (!email) {
    throw new Error("email required to send reset email");
  }

  try {
    const mailRes = await sendResetEmail(email, name);
    if (mailRes && mailRes.resetToken) {
      try {
        await db.execute(queries.SAVE_RESET_TOKEN, [
          email,
          mailRes.resetToken,
          mailRes.tokenExpiry,
        ]);
      } catch (saveErr) {
        console.warn(
          "[sendResetEmailAndSave] WARNING: failed to save reset token:",
          saveErr && (saveErr.stack || saveErr)
        );
      }
    } else {
      console.warn(
        "[sendResetEmailAndSave] Warning: sendResetEmail did not return resetToken",
        { email, mailRes }
      );
    }
    return mailRes;
  } catch (err) {
    console.warn("[sendResetEmailAndSave] sendResetEmail failed:", err);
    throw err;
  }
}

exports.sendResetEmailAndSave = sendResetEmailAndSave;
