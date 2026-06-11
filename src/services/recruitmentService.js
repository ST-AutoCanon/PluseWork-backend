const fs = require("fs/promises");
const path = require("path");
const { sendWithRetries } = require("../utils/mailer");
const { PDFParse } = require("pdf-parse");
const mammoth = require("mammoth");
const db = require("../config");

const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");
const {
  ADD_RECRUITMENT_CANDIDATE,
  GET_RECRUITMENT_CANDIDATES,
  GET_RECRUITMENT_CANDIDATE_BY_ID,
  UPDATE_RECRUITMENT_CANDIDATE,
  UPDATE_RECRUITMENT_STATUS,
  DELETE_RECRUITMENT_CANDIDATE,
  INSERT_RECRUITMENT_ASSESSMENT,
  UPDATE_RECRUITMENT_ASSESSMENT,
  GET_RECRUITMENT_ASSESSMENT_BY_ID,
  GET_LATEST_RECRUITMENT_ASSESSMENT_BY_ROUND,
  GET_RECRUITMENT_ASSESSMENTS,
  MARK_CONVERTED_TO_EMPLOYEE,
  INSERT_EMPLOYEE_FROM_RECRUITMENT,
  GET_RECRUITMENT_INTERVIEWERS,
  GET_ORGANIZATION_BY_ID,
} = require("../constants/recruitmentQueries");

function emptyToNull(v) {
  if (v === "" || v === undefined) return null;
  return v;
}

function toBool(v) {
  return v === true || v === 1 || v === "1" || v === "true" || v === "TRUE";
}

function normalizeDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).replace("T", " ");
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function getOrgDbName(orgId) {
  if (!orgId) {
    const err = new Error("orgId required");
    err.code = "ORG_REQUIRED";
    throw err;
  }
  return sanitizeDbName(`tenant_${orgId}`);
}

async function getTenantPoolForOrgId(orgId) {
  return getTenantPool(getOrgDbName(orgId));
}

function buildResumeUrl(orgId, file) {
  if (!file) return null;
  return `/recruitment/files/${orgId}/${file.filename}`;
}

function buildEmailHtml(emailBody = "") {
  return String(emailBody || "").replace(/\n/g, "<br/>");
}

function buildDefaultAssessmentEmail({
  candidateName,
  roundName,
  position,
  interviewerName,
  interviewDate,
  interviewLink,
  organizationName,
  organizationEmail,
  organizationAddress,
}) {
  return `Hi ${candidateName || "Candidate"},

Your ${roundName || "interview"} has been scheduled.

Interview Details
-------------------------
Position: ${position || "N/A"}
Interviewer: ${interviewerName || "TBA"}
Date & Time: ${interviewDate || "TBA"}
Meeting Link: ${interviewLink || "TBA"}

Organization Details
-------------------------
Organization: ${organizationName || "N/A"}
Email: ${organizationEmail || "N/A"}
Address: ${organizationAddress || "N/A"}

Please join on time.

Regards,
${organizationName || "HR Team"}`;
}

async function getOrganizationById(orgId) {
  const [rows] = await db.query(GET_ORGANIZATION_BY_ID, [orgId]);
  return rows?.[0] || null;
}

function normalizeResumeText(text = "") {
  return String(text || "").replace(/\u0000/g, " ");
}

function splitLines(text = "") {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) =>
      String(line || "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return String(match[1]).replace(/\s+/g, " ").trim();
  }
  return "";
}

function guessName(lines = []) {
  const skip = [
    "resume",
    "curriculum vitae",
    "cv",
    "profile",
    "summary",
    "objective",
    "skills",
    "experience",
    "education",
    "contact",
  ];

  const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const phoneRegex = /(\+91[\s-]?)?[6-9]\d{9}|(\+?\d{1,3}[\s-]?)?\d{10}/i;

  for (const line of lines.slice(0, 10)) {
    const lower = line.toLowerCase();
    if (skip.some((k) => lower.includes(k))) continue;
    if (emailRegex.test(line)) continue;
    if (phoneRegex.test(line)) continue;
    if (line.length < 2 || line.length > 60) continue;
    if (/^[a-zA-Z][a-zA-Z\s.'-]+$/.test(line)) return line;
  }

  return lines[0] || "";
}

function guessAppliedPosition(text = "", lines = []) {
  const roleRegex =
    /(frontend developer|backend developer|full stack developer|software engineer|web developer|react developer|node\.?js developer|python developer|java developer|intern|ui\/ux designer|qa engineer|devops engineer|data analyst|data scientist)/i;

  const match = text.match(roleRegex);
  if (match && match[1]) return String(match[1]).replace(/\s+/g, " ").trim();

  for (const line of lines.slice(0, 12)) {
    if (roleRegex.test(line)) return line;
  }

  return "";
}

function guessExperience(text = "") {
  const expLine =
    firstMatch(text, [
      /(?:total\s*)?experience[:\-\s]*([^\n]+)/i,
      /work\s*experience[:\-\s]*([^\n]+)/i,
      /professional\s*experience[:\-\s]*([^\n]+)/i,
    ]) || "";

  if (expLine) return expLine;

  const yearsMonths = text.match(
    /(\d+(?:\.\d+)?)\s*(?:\+?\s*)?(years?|yrs?|year)\s*(?:and\s*)?(?:(\d+)\s*(months?|mos?|month))?/i,
  );

  if (yearsMonths) {
    const years = yearsMonths[1];
    const months = yearsMonths[3];
    return months ? `${years} years ${months} months` : `${years} years`;
  }

  return "";
}

function parseResumeText(text = "") {
  const cleaned = String(normalizeResumeText(text)).replace(/\s+/g, " ").trim();
  const lines = splitLines(text);

  const email = firstMatch(cleaned, [
    /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i,
  ]);
  const phone = firstMatch(cleaned, [
    /(\+91[\s-]?)?([6-9]\d{9})/i,
    /(\+?\d{1,3}[\s-]?)?(\d{10})/i,
  ]);

  const currentCtc = firstMatch(cleaned, [
    /current\s*ctc[:\-\s]*([^\n,]+)/i,
    /ctc[:\-\s]*([^\n,]+)/i,
  ]);
  const expectedCtc = firstMatch(cleaned, [
    /expected\s*ctc[:\-\s]*([^\n,]+)/i,
    /ectc[:\-\s]*([^\n,]+)/i,
  ]);
  const noticePeriod = firstMatch(cleaned, [
    /notice\s*period[:\-\s]*([^\n,]+)/i,
  ]);
  const department = firstMatch(cleaned, [
    /department[:\-\s]*([^\n,]+)/i,
    /domain[:\-\s]*([^\n,]+)/i,
  ]);

  return {
    name: guessName(lines),
    email,
    phone,
    applied_position: guessAppliedPosition(cleaned, lines),
    department,
    source: "Resume Upload",
    current_ctc: currentCtc,
    expected_ctc: expectedCtc,
    notice_period: noticePeriod,
    total_experience: guessExperience(cleaned),
    status: "Applied",
    resume_url: "",
    raw_text: cleaned,
  };
}

async function extractTextFromResume(file) {
  const ext = path.extname(file.originalname || "").toLowerCase();

  if (ext === ".pdf") {
    const buffer = await fs.readFile(file.path);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    if (typeof parser.destroy === "function") await parser.destroy();
    return result?.text || "";
  }

  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ path: file.path });
    return result?.value || "";
  }

  if (ext === ".doc") {
    throw new Error("DOC files are not supported. Please upload PDF or DOCX.");
  }

  throw new Error("Unsupported resume format. Upload PDF or DOCX.");
}

async function parseResumeService(file) {
  try {
    const text = await extractTextFromResume(file);
    return parseResumeText(text);
  } finally {
    if (file?.path) {
      await fs.unlink(file.path).catch(() => {});
    }
  }
}

async function loadRecruitmentCandidate(pool, id, orgId) {
  const [rows] = await pool.query(GET_RECRUITMENT_CANDIDATE_BY_ID, [id, orgId]);
  return rows?.[0] || null;
}

function mapRecruitmentValues(payload, orgId, resumeFile, existing = null) {
  return {
    orgId,
    name: emptyToNull(payload.name) ?? existing?.name ?? null,
    email: emptyToNull(payload.email) ?? existing?.email ?? null,
    phone: emptyToNull(payload.phone) ?? existing?.phone ?? null,
    applied_position:
      emptyToNull(payload.applied_position) ??
      existing?.applied_position ??
      null,
    department: emptyToNull(payload.department) ?? existing?.department ?? null,
    source: emptyToNull(payload.source) ?? existing?.source ?? null,
    current_ctc:
      emptyToNull(payload.current_ctc) ?? existing?.current_ctc ?? null,
    expected_ctc:
      emptyToNull(payload.expected_ctc) ?? existing?.expected_ctc ?? null,
    notice_period:
      emptyToNull(payload.notice_period) ?? existing?.notice_period ?? null,
    total_experience:
      emptyToNull(payload.total_experience) ??
      existing?.total_experience ??
      null,
    status: emptyToNull(payload.status) ?? existing?.status ?? "Applied",
    resume_url: resumeFile
      ? buildResumeUrl(orgId, resumeFile)
      : existing?.resume_url || null,
    offer_ctc: emptyToNull(payload.offer_ctc) ?? existing?.offer_ctc ?? null,
    offer_letter_url:
      emptyToNull(payload.offer_letter_url) ??
      existing?.offer_letter_url ??
      null,
    joining_date:
      emptyToNull(payload.joining_date) ?? existing?.joining_date ?? null,
  };
}

function buildRecruitmentInsertValues(mapped) {
  return [
    mapped.orgId,
    mapped.name,
    mapped.email,
    mapped.phone,
    mapped.applied_position,
    mapped.department,
    mapped.current_ctc,
    mapped.expected_ctc,
    mapped.notice_period,
    mapped.total_experience,
    mapped.status,
    mapped.source,
    mapped.resume_url,
    mapped.offer_ctc,
    mapped.offer_letter_url,
    mapped.joining_date,
  ];
}

function buildRecruitmentUpdateValues(mapped, id) {
  return [
    mapped.name,
    mapped.email,
    mapped.phone,
    mapped.applied_position,
    mapped.department,
    mapped.current_ctc,
    mapped.expected_ctc,
    mapped.notice_period,
    mapped.total_experience,
    mapped.status,
    mapped.source,
    mapped.resume_url,
    mapped.offer_ctc,
    mapped.offer_letter_url,
    mapped.joining_date,
    id,
    mapped.orgId,
  ];
}

function baseRoundFromStatus(status = "") {
  const value = String(status || "")
    .trim()
    .toLowerCase();

  if (value === "screening") return "Screening";
  if (value === "technical round") return "Technical Round";
  if (value === "hr round") return "HR Round";
  if (value === "manager round") return "Manager Round";

  return "Screening";
}

function roundFamilyName(roundName = "") {
  return String(roundName || "")
    .trim()
    .replace(/\s+\d+$/, "")
    .trim();
}

function buildSequentialRoundName(baseRound, assessments = []) {
  const family = roundFamilyName(baseRound).toLowerCase();

  const count = (assessments || []).filter((row) => {
    const existingFamily = roundFamilyName(row.round_name || "").toLowerCase();
    return existingFamily === family;
  }).length;

  return count === 0 ? baseRound : `${baseRound} ${count + 1}`;
}

function buildEmailDefaults({
  candidate,
  roundName,
  interviewerId,
  interviewDate,
  interviewLink,
  organization,
}) {
  const emailSubject = `${roundName} Interview - ${candidate.name || "Candidate"}`;

  const emailBody = buildDefaultAssessmentEmail({
    candidateName: candidate.name,
    roundName,
    position: candidate.applied_position,
    interviewerName: interviewerId || "TBA",
    interviewDate,
    interviewLink,
    organizationName: organization?.name || "HR Team",
    organizationEmail:
      organization?.contact_email_id || organization?.admin_email,
    organizationAddress: organization?.company_address,
  });

  return { emailSubject, emailBody };
}

async function addRecruitmentService(payload, resumeFile, orgId) {
  const pool = await getTenantPoolForOrgId(orgId);
  const mapped = mapRecruitmentValues(payload, orgId, resumeFile, null);
  const values = buildRecruitmentInsertValues(mapped);

  const [result] = await pool.query(ADD_RECRUITMENT_CANDIDATE, values);
  return result;
}

async function getRecruitmentCandidatesService(orgId) {
  const pool = await getTenantPoolForOrgId(orgId);
  const [rows] = await pool.query(GET_RECRUITMENT_CANDIDATES, [orgId]);
  return rows;
}

async function getRecruitmentAssessmentsService(id, orgId) {
  const pool = await getTenantPoolForOrgId(orgId);
  const [rows] = await pool.query(GET_RECRUITMENT_ASSESSMENTS, [id, orgId]);
  return rows;
}

async function getRecruitmentCandidateByIdService(id, orgId) {
  const pool = await getTenantPoolForOrgId(orgId);
  const candidate = await loadRecruitmentCandidate(pool, id, orgId);

  if (!candidate) return null;

  const [assessments] = await pool.query(GET_RECRUITMENT_ASSESSMENTS, [
    id,
    orgId,
  ]);

  return {
    ...candidate,
    assessments: assessments || [],
  };
}

async function updateRecruitmentService(id, payload, resumeFile, orgId) {
  const pool = await getTenantPoolForOrgId(orgId);
  const existing = await loadRecruitmentCandidate(pool, id, orgId);

  if (!existing) {
    const err = new Error("Candidate not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  const mapped = mapRecruitmentValues(payload, orgId, resumeFile, existing);
  const values = buildRecruitmentUpdateValues(mapped, id);

  const [result] = await pool.query(UPDATE_RECRUITMENT_CANDIDATE, values);
  return result;
}

async function advanceRecruitmentService(id, payload, orgId) {
  const pool = await getTenantPoolForOrgId(orgId);
  const existing = await loadRecruitmentCandidate(pool, id, orgId);

  if (!existing) {
    const err = new Error("Candidate not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  const nextStatus =
    emptyToNull(payload.next_status) ?? emptyToNull(payload.status);

  const [result] = await pool.query(UPDATE_RECRUITMENT_STATUS, [
    nextStatus || existing.status || "Applied",
    id,
    orgId,
  ]);

  return result;
}

async function deleteRecruitmentService(id, orgId) {
  const pool = await getTenantPoolForOrgId(orgId);
  const [result] = await pool.query(DELETE_RECRUITMENT_CANDIDATE, [id, orgId]);
  return result;
}

async function assignInterviewService(candidateId, payload, orgId) {
  const pool = await getTenantPoolForOrgId(orgId);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [candidateRows] = await connection.query(
      GET_RECRUITMENT_CANDIDATE_BY_ID,
      [candidateId, orgId],
    );
    const candidate = candidateRows?.[0];

    if (!candidate) {
      const err = new Error("Candidate not found");
      err.code = "NOT_FOUND";
      throw err;
    }

    const [existingAssessments] = await connection.query(
      GET_RECRUITMENT_ASSESSMENTS,
      [candidateId, orgId],
    );

    const organization = await getOrganizationById(orgId);

    const baseRound = baseRoundFromStatus(candidate.status);
    const roundName = buildSequentialRoundName(
      baseRound,
      existingAssessments || [],
    );

    const interviewerId =
      emptyToNull(payload.interviewer_id) ??
      emptyToNull(payload.assigned_interviewer) ??
      null;

    const interviewDate = normalizeDateTime(payload.interview_date || null);
    const interviewLink = emptyToNull(payload.interview_link) ?? null;
    const sendInterviewEmail = Number(
      toBool(payload.send_interview_email) ? 1 : 0,
    );

    const { emailSubject, emailBody } = buildEmailDefaults({
      candidate,
      roundName,
      interviewerId,
      interviewDate,
      interviewLink,
      organization,
    });

    const [result] = await connection.query(INSERT_RECRUITMENT_ASSESSMENT, [
      candidateId,
      orgId,
      roundName,
      interviewerId,
      interviewDate,
      interviewLink,
      sendInterviewEmail,
      emailBody,
      emailSubject,
      null,
      null,
      null,
    ]);

    await connection.commit();

    if (sendInterviewEmail && candidate.email) {
      try {
        await sendWithRetries({
          sender: {
            email: process.env.BREVO_SENDER_EMAIL,
            name:
              organization?.name || process.env.PLATFORM_NAME || "PULSEWORK",
          },
          to: [
            {
              email: candidate.email,
              name: candidate.name,
            },
          ],
          subject: emailSubject,
          htmlContent: buildEmailHtml(emailBody),
          textContent: emailBody,
        });
      } catch (mailErr) {
        console.error(
          "Interview email send failed:",
          mailErr?.response?.body || mailErr,
        );
      }
    }

    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function findAssessmentForUpdate(
  connection,
  candidateId,
  orgId,
  payload,
) {
  const assessmentId = emptyToNull(payload.assessment_id);

  if (assessmentId) {
    const [rows] = await connection.query(GET_RECRUITMENT_ASSESSMENT_BY_ID, [
      assessmentId,
      orgId,
    ]);
    return rows?.[0] || null;
  }

  const roundName = emptyToNull(payload.round_name);

  if (!roundName) return null;

  const [rows] = await connection.query(
    GET_LATEST_RECRUITMENT_ASSESSMENT_BY_ROUND,
    [candidateId, orgId, roundName, roundName],
  );

  return rows?.[0] || null;
}

async function saveRecruitmentAssessmentService(
  candidateId,
  payload,
  orgId,
  roundName,
) {
  const pool = await getTenantPoolForOrgId(orgId);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [candidateRows] = await connection.query(
      GET_RECRUITMENT_CANDIDATE_BY_ID,
      [candidateId, orgId],
    );
    const candidate = candidateRows?.[0];

    if (!candidate) {
      const err = new Error("Candidate not found");
      err.code = "NOT_FOUND";
      throw err;
    }

    const organization = await getOrganizationById(orgId);
    const baseRound = roundFamilyName(roundName || payload.round_name || "");

    const latestAssessment = await findAssessmentForUpdate(
      connection,
      candidateId,
      orgId,
      payload,
    );

    const interviewerId =
      emptyToNull(payload.interviewer_id) ??
      emptyToNull(payload.assigned_interviewer) ??
      latestAssessment?.interviewer_id ??
      null;

    const interviewDate = normalizeDateTime(
      payload.interview_date || latestAssessment?.interview_date || null,
    );

    const interviewLink =
      emptyToNull(payload.interview_link) ??
      latestAssessment?.interview_link ??
      null;

    const sendInterviewEmail = Number(
      toBool(
        payload.send_interview_email ?? latestAssessment?.send_interview_email,
      )
        ? 1
        : 0,
    );

    const { emailSubject, emailBody } = buildEmailDefaults({
      candidate,
      roundName: baseRound,
      interviewerId,
      interviewDate,
      interviewLink,
      organization,
    });

    const score = emptyToNull(payload.score) ?? latestAssessment?.score ?? null;
    const decision =
      emptyToNull(payload.decision) ??
      emptyToNull(payload.status) ??
      latestAssessment?.decision ??
      null;
    const feedback =
      emptyToNull(payload.feedback) ?? latestAssessment?.feedback ?? null;

    let result;

    if (latestAssessment) {
      [result] = await connection.query(UPDATE_RECRUITMENT_ASSESSMENT, [
        interviewerId,
        interviewDate,
        interviewLink,
        sendInterviewEmail,
        emailBody,
        emailSubject,
        score,
        decision,
        feedback,
        latestAssessment.id,
        orgId,
      ]);
    } else {
      [result] = await connection.query(INSERT_RECRUITMENT_ASSESSMENT, [
        candidateId,
        orgId,
        baseRound || "Assessment",
        interviewerId,
        interviewDate,
        interviewLink,
        sendInterviewEmail,
        emailBody,
        emailSubject,
        score,
        decision,
        feedback,
      ]);
    }

    await connection.commit();

    if (sendInterviewEmail && candidate.email) {
      try {
        await sendWithRetries({
          sender: {
            email: process.env.BREVO_SENDER_EMAIL,
            name:
              organization?.name || process.env.PLATFORM_NAME || "PULSEWORK",
          },
          to: [
            {
              email: candidate.email,
              name: candidate.name,
            },
          ],
          subject: emailSubject,
          htmlContent: buildEmailHtml(emailBody),
          textContent: emailBody,
        });
      } catch (mailErr) {
        console.error(
          "Assessment email send failed:",
          mailErr?.response?.body || mailErr,
        );
      }
    }

    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateTechnicalFeedbackService(id, payload, orgId) {
  return saveRecruitmentAssessmentService(
    id,
    payload,
    orgId,
    "Technical Round",
  );
}

async function updateHrFeedbackService(id, payload, orgId) {
  return saveRecruitmentAssessmentService(id, payload, orgId, "HR Round");
}

async function updateManagerFeedbackService(id, payload, orgId) {
  return saveRecruitmentAssessmentService(id, payload, orgId, "Manager Round");
}

async function convertRecruitmentToEmployeeService(id, orgId) {
  const pool = await getTenantPoolForOrgId(orgId);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [candidateRows] = await connection.query(
      GET_RECRUITMENT_CANDIDATE_BY_ID,
      [id, orgId],
    );
    const candidate = candidateRows?.[0];

    if (!candidate) {
      const err = new Error("Candidate not found");
      err.code = "NOT_FOUND";
      throw err;
    }

    const employeeId = `EMP-${Date.now()}`;
    const fullName = String(candidate.name || "").trim();
    const [firstName, ...rest] = fullName.split(/\s+/);
    const lastName = rest.join(" ") || "";

    await connection.query(INSERT_EMPLOYEE_FROM_RECRUITMENT, [
      employeeId,
      firstName || candidate.name || null,
      lastName || null,
      candidate.email || null,
      candidate.phone || null,
      orgId,
    ]);

    await connection.query(MARK_CONVERTED_TO_EMPLOYEE, [employeeId, id, orgId]);

    await connection.commit();
    return { employeeId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getRecruitmentInterviewersService(orgId) {
  const pool = await getTenantPoolForOrgId(orgId);
  const [rows] = await pool.query(GET_RECRUITMENT_INTERVIEWERS, [orgId]);
  return rows;
}

module.exports = {
  parseResumeService,
  addRecruitmentService,
  getRecruitmentCandidatesService,
  getRecruitmentAssessmentsService,
  getRecruitmentCandidateByIdService,
  updateRecruitmentService,
  advanceRecruitmentService,
  deleteRecruitmentService,
  assignInterviewService,
  saveRecruitmentAssessmentService,
  updateTechnicalFeedbackService,
  updateHrFeedbackService,
  updateManagerFeedbackService,
  convertRecruitmentToEmployeeService,
  getRecruitmentInterviewersService,
  getOrganizationById,
};
