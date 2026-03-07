const db = require("../config");
const queries = require("../constants/empDetailsQueries");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const { sendResetEmail } = require("../utils/brevoMailer");
const { sendResetEmail: sendResetEmailMailer } = require("../utils/mailer");
const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");

function selectSendResetEmailFn(orgId) {
  if (String(orgId) === "1") return sendResetEmailMailer;
  return sendResetEmail;
}

async function getTenantPoolForOrgId(orgId) {
  if (!orgId) {
    const err = new Error("orgId required to get tenant pool");
    err.code = "ORG_REQUIRED";
    throw err;
  }
  const dbName = sanitizeDbName(`tenant_${orgId}`);
  return getTenantPool(dbName);
}

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
      } else {
      }
    } catch (e) {
      console.warn(
        "[file-delete] failed for",
        url,
        e && e.message ? e.message : e,
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

  let org = null;
  let employeeId;
  let suffix;
  let orgName = null;

  if (options && options.skipOrgLookup) {
    if (!options.providedEmployeeId || options.providedSuffix == null) {
      throw new Error(
        "skipOrgLookup requires providedEmployeeId and providedSuffix",
      );
    }
    employeeId = options.providedEmployeeId;
    suffix = options.providedSuffix;
    orgName = options.providedOrgName || null;
  } else {
    const [orgRows] = await db.execute(queries.SELECT_ORG_FOR_UPDATE, [
      resolvedOrg,
    ]);
    org = orgRows && orgRows[0] ? orgRows[0] : null;
    if (!org) throw new Error("Organization not found");

    orgName = org?.Name || org?.name || null;

    if (org.no_employees != null && !options.bypassOrgLimit) {
      const [countRows] = await conn.execute(
        queries.COUNT_ACTIVE_EMPLOYEES_BY_ORG,
        [resolvedOrg],
      );
      const current = Number(countRows && countRows[0] ? countRows[0].cnt : 0);
      const allowed = Number(org.no_employees);
      if (!Number.isNaN(allowed) && current >= allowed) {
        throw new Error(
          `Employee limit reached for organization (allowed: ${allowed}, current: ${current}).`,
        );
      }
    }

    const newCounter = Number(org.employee_counter || 0) + 1;
    await db.execute(queries.UPDATE_ORG_COUNTER, [newCounter, resolvedOrg]);

    suffix = newCounter;
    const suffixStr = String(suffix).padStart(PAD_DIGITS, "0");
    const prefix = (org.employee_prefix || "").toUpperCase();
    if (!prefix) {
      throw new Error(
        "Organization employee_prefix missing; cannot generate employee_id",
      );
    }
    employeeId = `${prefix}-${suffixStr}`;
  }

  const password = crypto.randomBytes(8).toString("hex");
  const hash = await bcrypt.hash(password, 10);

  const coreParams = [
    employeeId,
    suffix,
    data.first_name,
    data.middle_name || null,
    data.last_name,
    data.email,
    hash,
    data.phone_number || null,
    data.dob || null,
    resolvedOrg,
  ];

  await conn.execute(queries.ADD_EMPLOYEE_CORE, coreParams);

  const eid = employeeId;

  console.debug("[addFullEmployeeUsingConnection] saving employee", {
    employeeId: eid,
    org: resolvedOrg,
  });
  console.debug("[addFullEmployeeUsingConnection] file fields", {
    photo_url: data.photo_url,
    aadhaar_doc_url: data.aadhaar_doc_url,
    pan_doc_url: data.pan_doc_url,
    passport_doc_url: data.passport_doc_url,
    driving_license_doc_url: data.driving_license_doc_url,
    voter_id_doc_url: data.voter_id_doc_url,
    spouse_gov_doc_url: data.spouse_gov_doc_url,
    father_gov_doc_url: data.father_gov_doc_url,
    mother_gov_doc_url: data.mother_gov_doc_url,
    child1_gov_doc_url: data.child1_gov_doc_url,
    resume_url: data.resume_url,
    other_docs_urls: data.other_docs_urls || data.other_docs,
  });
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
      data.tenth_cert_url || data.tenth_cert || data.tenth_cert_urls,
    ),
    data.twelfth_institution || null,
    data.twelfth_year || null,
    data.twelfth_board || null,
    data.twelfth_score || null,
    arrayToJsonOrNull(
      data.twelfth_cert_url || data.twelfth_cert || data.twelfth_cert_urls,
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

  if (data.supervisor_id) {
    await conn.execute(queries.INSERT_SUPERVISOR_ASSIGNMENT, [
      eid,
      data.supervisor_id,
      data.joining_date || new Date(),
    ]);
  }

  const otherDocsRaw = data.other_docs_urls || data.other_docs || null;
  const otherDocs = normalizeToStringArray(otherDocsRaw);
  if (otherDocs.length) {
    for (const url of otherDocs) {
      await conn.execute(queries.ADD_EMPLOYEE_OTHER_DOC, [eid, url]);
    }
  }

  const fullName = `${data.first_name || ""} ${data.last_name || ""}`.trim();
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

  return { employee_id: eid, tempPassword: password, orgName };
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
    (f) => !data[f] || String(data[f]).trim() === "",
  );

  if (!data.org_id || String(data.org_id).trim() === "") {
    missing.push("org_id");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }

  const tenantPool = await getTenantPoolForOrgId(data.org_id);
  const conn = await tenantPool.getConnection();
  try {
    await conn.beginTransaction();
    const res = await addFullEmployeeUsingConnection(conn, data, options);
    await conn.commit();

    try {
      const sendResetEmailFn = selectSendResetEmailFn(data.org_id);

      const mailRes = await sendResetEmailFn(
        data.email,
        `${data.first_name} ${data.last_name}`,
        {
          inviterName: `${data.inviterName}` || null,
          orgName: res.orgName || null,
          platformName: "PULSEWORK",
          resetTtlHours: 72,
        },
      );

      if (mailRes && mailRes.resetToken) {
        try {
          const tenantConn2 = await tenantPool.getConnection();
          try {
            await tenantConn2.execute(queries.SAVE_RESET_TOKEN, [
              data.email,
              mailRes.resetToken,
              mailRes.tokenExpiry,
              data.org_id,
            ]);
          } finally {
            try {
              tenantConn2.release();
            } catch (e) {}
          }
        } catch (tenantSaveErr) {
          console.warn(
            "[addFullEmployee] WARNING: failed to save reset token in tenant DB:",
            tenantSaveErr && (tenantSaveErr.stack || tenantSaveErr),
          );
        }

        try {
          await db.execute(queries.SAVE_RESET_TOKEN_MASTER, [
            mailRes.resetToken,
            data.org_id,
          ]);
        } catch (masterSaveErr) {
          console.warn(
            "[addFullEmployee] WARNING: failed to save reset token in master DB:",
            masterSaveErr && (masterSaveErr.stack || masterSaveErr),
          );
        }
      }
    } catch (mailErr) {
      console.warn("[addFullEmployee] reset-email failed:", mailErr);
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
  normalizeOrgId(data);

  let orgId = data.org_id || data.orgId || null;
  if (!orgId) {
    const [maybe] = await db
      .execute(queries.GET_ORG_FOR_EMPLOYEE_ID, [data.employee_id])
      .catch(() => [[]]);
    if (maybe && maybe.length) {
      orgId = maybe[0].Org_id || maybe[0].org_id || null;
    }
  }

  if (!orgId) {
    throw new Error("org_id required to edit employee");
  }

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();
  try {
    await conn.beginTransaction();

    const eid = data.employee_id;

    const [existingRows] = await conn.execute(queries.GET_FULL_EMPLOYEE, [eid]);
    const existing = existingRows && existingRows[0] ? existingRows[0] : {};

    const hasKey = (k) => Object.prototype.hasOwnProperty.call(data, k);

    const toUrlArray = (val) => {
      if (val == null) return [];
      if (Array.isArray(val)) return val.filter(Boolean).map(String);
      if (typeof val === "string") {
        const s = val.trim();
        if (!s) return [];
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
        } catch {}
        return [s];
      }
      return [String(val)];
    };

    const diffUrls = (oldVal, newVal) => {
      const oldArr = toUrlArray(oldVal);
      const newArr = toUrlArray(newVal);
      return oldArr.filter((u) => !newArr.includes(u));
    };

    const resolveFieldValue = (field, ...alts) => {
      if (hasKey(field)) return data[field];
      for (const alt of alts) {
        if (hasKey(alt)) return data[alt];
      }
      return existing[field];
    };

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
      if (!hasKey(field)) continue;
      const removed = diffUrls(existing[field], data[field]);
      if (removed.length) deleteFilesByUrlsMixed(removed);
    }

    const resumeValue = resolveFieldValue(
      "resume_url",
      "resume",
      "resume_urls",
    );
    const resumeRemoved = diffUrls(existing.resume_url, resumeValue);
    if (resumeRemoved.length) deleteFilesByUrlsMixed(resumeRemoved);

    const otherDocsValue = resolveFieldValue("other_docs", "other_docs_urls");
    const otherDocsRemoved = diffUrls(existing.other_docs, otherDocsValue);
    if (otherDocsRemoved.length) deleteFilesByUrlsMixed(otherDocsRemoved);

    if (hasKey("additional_certs")) {
      try {
        const oldAdditional = tryParseJSON(existing.additional_certs) || [];
        const newAdditional = hasKey("additional_certs")
          ? data.additional_certs || []
          : oldAdditional;

        const newUrls = new Set(
          (newAdditional || [])
            .flatMap((cert) =>
              toUrlArray(cert && (cert.file_urls || cert.files || cert.file)),
            )
            .map(String),
        );

        if (Array.isArray(oldAdditional) && oldAdditional.length) {
          for (const cert of oldAdditional) {
            const oldUrls = toUrlArray(
              cert && (cert.file_urls || cert.files || cert.file),
            );
            const removed = oldUrls.filter((u) => !newUrls.has(u));
            if (removed.length) deleteFilesByUrlsMixed(removed);
          }
        }
      } catch (e) {
        console.warn(
          "[editFullEmployee] could not parse existing.additional_certs",
          e,
        );
      }
    }

    if (hasKey("experience")) {
      try {
        const oldExp = tryParseJSON(existing.experience) || [];
        const newExp = hasKey("experience") ? data.experience || [] : oldExp;

        const newUrls = new Set(
          (newExp || [])
            .flatMap((ex) =>
              toUrlArray(ex && (ex.doc_urls || ex.files || ex.doc)),
            )
            .map(String),
        );

        if (Array.isArray(oldExp) && oldExp.length) {
          for (const ex of oldExp) {
            const oldUrls = toUrlArray(
              ex && (ex.doc_urls || ex.files || ex.doc),
            );
            const removed = oldUrls.filter((u) => !newUrls.has(u));
            if (removed.length) deleteFilesByUrlsMixed(removed);
          }
        }
      } catch (e) {
        console.warn(
          "[editFullEmployee] could not parse existing.experience",
          e,
        );
      }
    }

    await conn.execute(queries.UPDATE_EMPLOYEE_CORE, [
      pick("first_name"),
      pick("middle_name"),
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
        resolveCertValue("tenth_cert_url", ["tenth_cert", "tenth_cert_urls"]),
      ),
      pick("twelfth_institution") || null,
      pick("twelfth_year") || null,
      pick("twelfth_board") || null,
      pick("twelfth_score") || null,
      arrayToJsonOrNull(
        resolveCertValue("twelfth_cert_url", [
          "twelfth_cert",
          "twelfth_cert_urls",
        ]),
      ),
      pick("ug_institution") || null,
      pick("ug_year") || null,
      pick("ug_board") || null,
      pick("ug_score") || null,
      arrayToJsonOrNull(
        resolveCertValue("ug_cert_url", ["ug_cert", "ug_cert_urls"]),
      ),
      pick("pg_institution") || null,
      pick("pg_year") || null,
      pick("pg_board") || null,
      pick("pg_score") || null,
      arrayToJsonOrNull(
        resolveCertValue("pg_cert_url", ["pg_cert", "pg_cert_urls"]),
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
          exp.doc_urls || exp.files || exp.doc || null,
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
    }

    const oldSupervisor = existing.supervisor_id || null;
    const newSupervisor = hasKey("supervisor_id")
      ? data.supervisor_id || null
      : oldSupervisor;

    if (oldSupervisor !== newSupervisor) {
      const today = new Date().toISOString().slice(0, 10);

      if (oldSupervisor) {
        await conn.execute(queries.UPDATE_ACTIVE_SUPERVISOR_ASSIGNMENT_END, [
          today,
          eid,
        ]);
      }

      if (newSupervisor) {
        await conn.execute(queries.INSERT_SUPERVISOR_ASSIGNMENT, [
          eid,
          newSupervisor,
          today,
        ]);
      }
    }

    await conn.commit();
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

exports.getFullEmployee = async (employeeId, orgId) => {
  if (!orgId) throw new Error("orgId required");

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(queries.GET_FULL_EMPLOYEE, [
    employeeId,
  ]);

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

  return row;
};

exports.searchEmployees = async (search, fromDate, toDate, orgId) => {
  try {
    const tenantPool = orgId ? await getTenantPoolForOrgId(orgId) : null;
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

    const executor = tenantPool || db;
    const [rows] = (await executor.execute)
      ? await executor.execute(query, params)
      : await executor.query(query, params);
    return rows;
  } catch (error) {
    console.error("❌ Error fetching employees from database:", error);
    throw new Error("Error fetching employees from database");
  }
};

exports.deactivateEmployee = async (employeeId, orgId) => {
  if (!orgId) throw new Error("orgId required");

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [result] = await tenantPool.execute(queries.UPDATE_EMPLOYEE_STATUS, [
    employeeId,
  ]);

  if (!result.affectedRows) {
    throw new Error("Employee not found or already deactivated");
  }

  return { message: "Employee deactivated successfully" };
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

exports.getUserRoles = async (orgId) => {
  if (orgId) {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [rows] = await tenantPool.query(queries.GET_USER_ROLES);
    return rows;
  }
  const [rows] = await db.execute(queries.GET_USER_ROLES);
  return rows;
};

exports.getPositions = async (role) => {
  if (!role) return [];

  try {
    const params = [role, role, role, role, role, role];
    const [rows] = await db.execute(
      queries.GET_POSITIONS_BY_ROLE_AND_DEPT,
      params,
    );
    return rows.map((r) => r.name);
  } catch (err) {
    console.error("[getPositions] error:", err && (err.stack || err));
    throw err;
  }
};

exports.getSupervisorsByPosition = async (position, department_id, orgId) => {
  if (!orgId) throw new Error("orgId required");

  const tenantPool = await getTenantPoolForOrgId(orgId);

  const [rankRows] = await db.execute(queries.GET_POSITION_RANK, [position]);

  const currentRank = rankRows?.[0]?.rank;
  if (!currentRank) return [];

  const minRank = Math.max(1, currentRank - 3);
  const maxRank = currentRank - 1;
  if (minRank > maxRank) return [];

  const [posRows] = await db.execute(
    queries.GET_MASTER_POSITIONS_BY_RANK_RANGE,
    [minRank, maxRank, department_id || null],
  );

  if (!posRows?.length) return [];

  const positionNames = posRows.map((r) => r.name);

  const placeholders = positionNames.map(() => "?").join(",");

  const finalQuery = queries.GET_SUPERVISORS_BY_POSITION_FILTERED.replace(
    /%POSITION_LIST%/g,
    placeholders,
  );

  const params = [...positionNames, orgId, ...positionNames];

  const [rows] = await tenantPool.execute(finalQuery, params);
  return rows;
};

exports.getSupervisorHistory = async (employeeId, orgId) => {
  if (!orgId) throw new Error("orgId required");
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.execute(queries.GET_SUPERVISOR_HISTORY, [
    employeeId,
  ]);
  return rows;
};

exports.addFullEmployeeUsingConnection = addFullEmployeeUsingConnection;

async function sendResetEmailAndSave(email, name, opts = {}, saveConn = null) {
  if (!email) {
    throw new Error("email required to send reset email");
  }

  const providedOrgId = opts.orgId || opts.org_id || null;
  const sendFn = selectSendResetEmailFn(providedOrgId);

  try {
    const mailRes = await sendFn(email, name, opts);

    if (mailRes && mailRes.resetToken) {
      const token = mailRes.resetToken;
      const expiry = mailRes.tokenExpiry || null;

      try {
        if (saveConn && typeof saveConn.execute === "function") {
          await saveConn.execute(queries.SAVE_RESET_TOKEN, [
            email,
            token,
            expiry,
            providedOrgId,
          ]);
        } else if (providedOrgId) {
          const tenantPool = await getTenantPoolForOrgId(providedOrgId);
          const tenantConn = await tenantPool.getConnection();
          try {
            await tenantConn.execute(queries.SAVE_RESET_TOKEN, [
              email,
              token,
              expiry,
              providedOrgId,
            ]);
          } finally {
            try {
              tenantConn.release();
            } catch (e) {}
          }
        } else {
          console.warn(
            "[sendResetEmailAndSave] orgId not provided and no saveConn - skipping tenant password_resets save",
          );
        }
      } catch (saveErr) {
        console.warn(
          "[sendResetEmailAndSave] WARNING: failed to save reset token in tenant DB:",
          saveErr && (saveErr.stack || saveErr),
        );
      }

      try {
        await db.execute(queries.SAVE_RESET_TOKEN_MASTER, [
          token,
          providedOrgId,
        ]);
      } catch (masterSaveErr) {
        console.warn(
          "[sendResetEmailAndSave] WARNING: failed to save reset token in master DB:",
          masterSaveErr && (masterSaveErr.stack || masterSaveErr),
        );
      }
    } else {
      console.warn(
        "[sendResetEmailAndSave] Warning: sendResetEmail did not return resetToken",
        { email, mailRes },
      );
    }

    return mailRes;
  } catch (err) {
    console.warn("[sendResetEmailAndSave] sendResetEmail failed:", err);
    throw err;
  }
}

exports.sendResetEmailAndSave = sendResetEmailAndSave;
