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
  // If value is an ISO-like local datetime string (from <input type="datetime-local">),
  // preserve the local fields as-is instead of converting to UTC via toISOString().
  const isoLocalMatch = String(value)
    .trim()
    .match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/);
  if (isoLocalMatch) {
    const withSeconds =
      String(value).includes(":") && String(value).split(":").length >= 3;
    const base = String(value); // keep the 'T' separator
    return withSeconds ? base : `${base}:00`;
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).replace("T", " ");

  const pad = (n) => String(n).padStart(2, "0");
  // Format using local date/time components to preserve the original intent (local time)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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
  return String(text || "")
    .replace(/\u0000/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function splitLines(text = "") {
  return String(text || "")
    .split(/\n/)
    .map((line) =>
      String(line || "")
        .replace(/[ \t]+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

function collapseSpaces(value = "") {
  return String(value || "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[1]) return collapseSpaces(match[1]);
      return collapseSpaces(match[0]);
    }
  }
  return "";
}

function normalizePhone(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length > 10) {
    const withoutCountry = digits.startsWith("91") ? digits.slice(2) : digits;
    if (withoutCountry.length === 10) return withoutCountry;
  }

  return digits.length >= 10 && digits.length <= 15 ? digits : "";
}

function isLikelyPhone(value = "") {
  const digits = String(value || "").replace(/\D/g, "");
  return (
    digits.length === 10 ||
    (digits.length === 12 && digits.startsWith("91")) ||
    (digits.length === 11 && digits.startsWith("0"))
  );
}

function extractPhone(text = "", lines = []) {
  const sourceLines = Array.isArray(lines) ? lines : [];
  const candidates = [];
  const seen = new Set();

  const addCandidate = (value) => {
    if (!value) return;
    const normalized = normalizePhone(value);
    if (!normalized || !isLikelyPhone(normalized)) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  for (const line of sourceLines) {
    const trimmed = String(line || "").trim();
    if (!trimmed) continue;

    const explicitMatch = trimmed.match(
      /(?:mobile|phone|contact|whatsapp|cell|telephone|mob)\b[^0-9+]{0,8}([+0-9\-\s]{4,15})/i,
    );
    if (explicitMatch && explicitMatch[1]) addCandidate(explicitMatch[1]);

    const lineMatches = trimmed.match(/(?:\+?91[\s-]?)?[6-9]\d{9}/g);
    if (lineMatches) {
      for (const match of lineMatches) addCandidate(match);
    }
  }

  const textMatches =
    String(text || "").match(/(?:\+?91[\s-]?)?[6-9]\d{9}/g) || [];
  for (const match of textMatches) addCandidate(match);

  if (candidates.length) return candidates[0];

  const fallback = String(text || "").match(/\b(?:\+?\d{1,3}[\s-]?)?\d{10}\b/g);
  if (fallback && fallback[0]) addCandidate(fallback[0]);

  return candidates[0] || "";
}

function formatExperience(years = 0, months = 0) {
  let y = Number(years) || 0;
  let m = Number(months) || 0;

  if (m >= 12) {
    y += Math.floor(m / 12);
    m = m % 12;
  }

  const parts = [];
  if (y > 0) parts.push(`${y} Year${y === 1 ? "" : "s"}`);
  if (m > 0) parts.push(`${m} Month${m === 1 ? "" : "s"}`);

  return parts.join(" ");
}

function normalizeExperiencePhrase(value = "") {
  const text = collapseSpaces(value);
  if (!text) return "";

  const explicit = text.match(
    /(\d+(?:\.\d+)?)\s*(?:\+?\s*)?(years?|yrs?|year)\s*(?:and\s*)?(?:(\d+)\s*(months?|mos?|month))?/i,
  );

  if (explicit) {
    const yearsRaw = explicit[1];
    const monthsRaw = explicit[3];

    if (monthsRaw !== undefined) {
      const years = Number(yearsRaw);
      const months = Number(monthsRaw);
      if (!Number.isNaN(years) && !Number.isNaN(months)) {
        return formatExperience(years, months);
      }
    }

    const yearsNumber = Number(yearsRaw);
    if (!Number.isNaN(yearsNumber)) {
      if (String(yearsRaw).includes(".")) {
        const wholeYears = Math.floor(yearsNumber);
        const months = Math.round((yearsNumber - wholeYears) * 12);
        return formatExperience(wholeYears, months);
      }
      return formatExperience(yearsNumber, 0);
    }
  }

  const yearsOnly = text.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?|year)\b/i);
  if (yearsOnly) {
    const yearsNumber = Number(yearsOnly[1]);
    if (!Number.isNaN(yearsNumber)) {
      if (String(yearsOnly[1]).includes(".")) {
        const wholeYears = Math.floor(yearsNumber);
        const months = Math.round((yearsNumber - wholeYears) * 12);
        return formatExperience(wholeYears, months);
      }
      return formatExperience(yearsNumber, 0);
    }
  }

  const monthsOnly = text.match(/(\d+)\s*(?:months?|mos?|month)\b/i);
  if (monthsOnly) {
    const months = Number(monthsOnly[1]);
    if (!Number.isNaN(months)) return formatExperience(0, months);
  }

  return "";
}

function extractExperience(text = "", lines = []) {
  const linePatterns = [
    /(?:total\s*)?(?:work\s*)?experience[:\-\s]*([^\n]+)/i,
    /(?:professional\s*)?experience[:\-\s]*([^\n]+)/i,
    /\bexp[:\-\s]*([^\n]+)/i,
  ];

  for (const line of lines || []) {
    for (const pattern of linePatterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        const parsed = normalizeExperiencePhrase(match[1]);
        if (parsed) return parsed;
      }
    }
  }

  const textPatterns = [
    /(?:total\s*)?(?:work\s*)?experience[:\-\s]*([^\n]+)/i,
    /(?:professional\s*)?experience[:\-\s]*([^\n]+)/i,
    /\bexp[:\-\s]*([^\n]+)/i,
  ];

  for (const pattern of textPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const parsed = normalizeExperiencePhrase(match[1]);
      if (parsed) return parsed;
    }
  }

  const generic = normalizeExperiencePhrase(text);
  return generic || "";
}

function extractDepartment(lines = [], text = "") {
  const departmentHints = [
    "engineering",
    "software",
    "development",
    "information technology",
    "it",
    "technology",
    "data",
    "analytics",
    "finance",
    "accounts",
    "accounting",
    "hr",
    "human resources",
    "marketing",
    "sales",
    "operations",
    "administration",
    "admin",
    "design",
    "product",
    "quality assurance",
    "qa",
    "customer support",
    "support",
    "business",
    "research",
    "legal",
    "logistics",
    "manufacturing",
    "healthcare",
    "education",
    "consulting",
    "network",
    "security",
    "media",
    "content",
  ];

  const normalizeDepartmentValue = (value = "") => {
    const cleaned = collapseSpaces(value)
      .replace(/^[:\-\s]+/, "")
      .replace(/[.]+$/g, "")
      .split(/\s+\|\s+|;|,/)[0]
      .trim();

    if (!cleaned) return "";

    const lower = cleaned.toLowerCase();
    if (
      /\b(?:resume|cv|profile|summary|objective|skills|experience|education|contact|personal|address|phone|email|linkedin|github)\b/i.test(
        lower,
      )
    ) {
      return "";
    }

    const withoutRoleWords = cleaned
      .replace(
        /\b(?:developer|engineer|analyst|manager|lead|specialist|consultant|assistant|associate|intern|trainee|executive)\b/gi,
        "",
      )
      .trim();
    const candidate = collapseSpaces(withoutRoleWords);

    if (!candidate) return "";

    if (candidate.length > 50) return "";

    const lowerCandidate = candidate.toLowerCase();
    const isKnownDepartment = departmentHints.some((hint) =>
      lowerCandidate.includes(hint),
    );

    if (!isKnownDepartment) {
      const isShortLabel = candidate.split(/\s+/).length <= 3;
      return isShortLabel && /^[a-zA-Z/&() .-]+$/.test(candidate)
        ? candidate
        : "";
    }

    return candidate;
  };

  for (const line of lines || []) {
    const match = line.match(
      /(?:department|domain|specialization|stream)[:\-\s]*([^\n]+)/i,
    );
    if (match && match[1]) {
      const department = normalizeDepartmentValue(match[1]);
      if (department) return department;
    }
  }

  const match = String(text || "").match(
    /\b(?:department|domain|specialization|stream)[:\-\s]*([A-Za-z0-9 &/().,+-]{2,80})/i,
  );
  if (match && match[1]) {
    const department = normalizeDepartmentValue(match[1]);
    if (department) return department;
  }

  return "";
}

function isSkillsHeadingLine(line = "") {
  const value = collapseSpaces(line).toLowerCase();
  return /^(?:key\s+skills|technical\s+skills?|skills?|core\s+skills?|core\s+competencies|areas?\s+of\s+expertise)\b[:\-\s]*$/i.test(
    value,
  );
}

function isResumeSectionHeading(line = "") {
  const value = collapseSpaces(line).toLowerCase();

  const headings = [
    "experience",
    "work experience",
    "professional experience",
    "education",
    "qualification",
    "qualifications",
    "project",
    "projects",
    "certification",
    "certifications",
    "summary",
    "profile",
    "objective",
    "contact",
    "personal details",
    "personal information",
    "languages",
    "hobbies",
    "interests",
    "declaration",
    "references",
    "achievements",
    "training",
    "internship",
    "work history",
    "employment history",
    "technical skills",
    "key skills",
    "core skills",
    "skills",
    "core competencies",
    "areas of expertise",
  ];

  return headings.some(
    (heading) =>
      value === heading ||
      value.startsWith(`${heading}:`) ||
      value.startsWith(`${heading} -`) ||
      value.startsWith(`${heading} `),
  );
}

function extractSkills(lines = [], text = "") {
  const normalizedLines = Array.isArray(lines) ? lines : [];

  const inlinePatterns = [
    /(?:^|\b)(?:key\s+skills|technical\s+skills?|skills?|core\s+skills?|core\s+competencies|areas?\s+of\s+expertise)[:\-\s]+(.+)$/i,
  ];

  for (let i = 0; i < normalizedLines.length; i++) {
    const line = normalizedLines[i];

    for (const pattern of inlinePatterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        const value = collapseSpaces(match[1]).replace(/^[\-\s:]+/, "");
        if (value && !isSkillsHeadingLine(value)) return value;
      }
    }

    if (isSkillsHeadingLine(line)) {
      const collected = [];

      for (let j = i + 1; j < normalizedLines.length; j++) {
        const next = collapseSpaces(normalizedLines[j]);

        if (!next) continue;

        if (isResumeSectionHeading(next) && !isSkillsHeadingLine(next)) {
          break;
        }

        const cleanedItem = next.replace(/^[•\-*]\s*/, "").trim();

        if (!cleanedItem) continue;

        if (cleanedItem.length === 1 && /^[A-Za-z]$/.test(cleanedItem)) {
          continue;
        }

        collected.push(cleanedItem);

        if (collected.length >= 8) break;
      }

      const combined = collapseSpaces(collected.join(", "));
      if (combined) return combined;
    }
  }

  const textMatch = String(text || "").match(
    /(?:key\s+skills|technical\s+skills?|skills?|core\s+skills?|core\s+competencies|areas?\s+of\s+expertise)[:\-\s]+([^\n]+)/i,
  );

  if (textMatch && textMatch[1]) {
    const value = collapseSpaces(textMatch[1]).replace(/^[\-\s:]+/, "");
    if (value && !isSkillsHeadingLine(value) && value.length > 1) return value;
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
  if (match && match[1]) return collapseSpaces(match[1]);

  for (const line of lines.slice(0, 12)) {
    if (roleRegex.test(line)) return line;
  }

  return "";
}

function parseResumeText(text = "") {
  const originalText = normalizeResumeText(text);
  const lines = splitLines(originalText);
  const cleaned = originalText.replace(/[ \t]+/g, " ").trim();

  const email = firstMatch(cleaned, [
    /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i,
  ]);

  const phone = extractPhone(originalText, lines);

  const currentCtc = firstMatch(originalText, [
    /current\s*ctc[:\-\s]*([^\n,]+)/i,
    /ctc[:\-\s]*([^\n,]+)/i,
  ]);

  const expectedCtc = firstMatch(originalText, [
    /expected\s*ctc[:\-\s]*([^\n,]+)/i,
    /ectc[:\-\s]*([^\n,]+)/i,
  ]);

  const noticePeriod = firstMatch(originalText, [
    /notice\s*period[:\-\s]*([^\n,]+)/i,
  ]);

  const department = extractDepartment(lines, originalText);
  const skills = extractSkills(lines, originalText);

  return {
    name: guessName(lines),
    email,
    phone,
    applied_position: guessAppliedPosition(cleaned, lines),
    department,
    skills,
    source: "Resume Upload",
    current_ctc: currentCtc,
    expected_ctc: expectedCtc,
    notice_period: noticePeriod,
    total_experience: extractExperience(originalText, lines),
    status: "Applied",
    resume_url: "",
    raw_text: originalText,
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
    skills: emptyToNull(payload.skills) ?? existing?.skills ?? null,
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

function normalizeAssessmentFeedback(feedback) {
  if (!feedback) return {};

  if (typeof feedback === "object") {
    return feedback;
  }

  try {
    return JSON.parse(feedback);
  } catch {
    return {
      notes: feedback,
      ratings: {},
      strengths: [],
      improvements: [],
    };
  }
}

function buildRecruitmentInsertValues(mapped) {
  return [
    mapped.orgId,
    mapped.name,
    mapped.email,
    mapped.phone,
    mapped.applied_position,
    mapped.department,
    mapped.skills,
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
    mapped.skills,
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
  interviewerName,
  interviewDate,
  interviewLink,
  organization,
}) {
  const emailSubject = `${roundName} Interview - ${candidate.name || "Candidate"}`;

  const emailBody = buildDefaultAssessmentEmail({
    candidateName: candidate.name,
    roundName,
    position: candidate.applied_position,
    interviewerName: interviewerName || "TBA",
    interviewDate,
    interviewLink,
    organizationName: organization?.name || "HR Team",
    organizationEmail:
      organization?.contact_email_id || organization?.admin_email,
    organizationAddress: organization?.company_address,
  });

  return { emailSubject, emailBody };
}

function normalizeOfferDecision(value = "") {
  const decision = String(value || "")
    .trim()
    .toLowerCase();

  if (["accepted", "accept", "yes", "confirmed"].includes(decision)) {
    return "Accepted";
  }

  if (["rejected", "reject", "no", "declined"].includes(decision)) {
    return "Rejected";
  }

  if (["pending", "hold", "later", "awaiting"].includes(decision)) {
    return "Pending";
  }

  return null;
}

function getRecruitmentStatusEmailContent({
  candidate,
  organization,
  newStatus,
  previousStatus,
  offerDecision,
}) {
  const organizationName = organization?.name || "HR Team";
  const candidateName = candidate?.name || "Candidate";

  if (newStatus === "Offer Acceptance" && previousStatus === "Manager Round") {
    return {
      subject: `Offer Acceptance Request - ${candidateName}`,
      body: `Hi ${candidateName},

Congratulations! You have progressed to the offer acceptance stage.
Please confirm whether you would like to accept the offer.
If you accept, we will proceed with releasing your offer letter.

Regards,
${organizationName}`,
    };
  }

  if (newStatus === "Offer Released") {
    return {
      subject: `Offer Letter Released - ${candidateName}`,
      body: `Hi ${candidateName},

Your offer letter has been released. Please review it carefully and share your decision.

Regards,
${organizationName}`,
    };
  }

  if (newStatus === "Offer Status") {
    const decisionLabel = normalizeOfferDecision(offerDecision) || "Pending";
    return {
      subject: `Offer Status Update - ${candidateName}`,
      body: `Hi ${candidateName},

Your offer status has been updated to ${decisionLabel}.
Please reach out to our team if you need any assistance.

Regards,
${organizationName}`,
    };
  }

  if (newStatus === "Onboarding") {
    return {
      subject: `Onboarding Documents Request - ${candidateName}`,
      body: `Hi ${candidateName},

Welcome to the onboarding stage. Please attach your original documents as requested so we can complete your onboarding.

Regards,
${organizationName}`,
    };
  }

  return null;
}

async function sendRecruitmentStatusEmail({
  candidate,
  orgId,
  newStatus,
  previousStatus,
  offerDecision,
  sendEmail = true,
  emailSubject = null,
  emailBody = null,
}) {
  if (!candidate?.email || !sendEmail) return;

  const organization = await getOrganizationById(orgId);

  const defaultEmail = getRecruitmentStatusEmailContent({
    candidate,
    organization,
    newStatus,
    previousStatus,
    offerDecision,
  });

  const statusEmail =
    emailSubject || emailBody
      ? {
          subject: emailSubject || defaultEmail?.subject,
          body: emailBody || defaultEmail?.body,
        }
      : defaultEmail;

  if (!statusEmail || !statusEmail.subject || !statusEmail.body) return;

  try {
    await sendWithRetries({
      sender: {
        email: process.env.BREVO_SENDER_EMAIL,
        name: organization?.name || process.env.PLATFORM_NAME || "PULSEWORK",
      },
      to: [
        {
          email: candidate.email,
          name: candidate.name,
        },
      ],
      subject: statusEmail.subject,
      htmlContent: buildEmailHtml(statusEmail.body),
      textContent: statusEmail.body,
    });
  } catch (mailErr) {
    console.error(
      "Recruitment status email send failed:",
      mailErr?.response?.body || mailErr,
    );
  }
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
    assessments: (assessments || []).map((item) => ({
      ...item,
      feedback_json: normalizeAssessmentFeedback(item.feedback),
    })),
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

  try {
    const nextStatus = emptyToNull(payload.status) ?? mapped.status;
    if (nextStatus) {
      const shouldSendStatusEmail = payload.hasOwnProperty("send_status_email")
        ? toBool(payload.send_status_email)
        : true;

      await sendRecruitmentStatusEmail({
        candidate: {
          ...existing,
          ...mapped,
          email: mapped.email ?? existing?.email ?? null,
          name: mapped.name ?? existing?.name ?? null,
        },
        orgId,
        newStatus: nextStatus,
        previousStatus: existing?.status || "Applied",
        offerDecision: payload.offer_decision,
        sendEmail: shouldSendStatusEmail,
        emailSubject: emptyToNull(payload.email_subject) || null,
        emailBody: emptyToNull(payload.email_body) || null,
      });
    }
  } catch (mailErr) {
    console.error("Recruitment status email dispatch failed:", mailErr);
  }

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

  try {
    await sendRecruitmentStatusEmail({
      candidate: {
        ...existing,
        status: nextStatus || existing.status || "Applied",
        email: existing.email,
        name: existing.name,
      },
      orgId,
      newStatus: nextStatus || existing.status || "Applied",
      previousStatus: existing?.status || "Applied",
      offerDecision: payload.offer_decision,
    });
  } catch (mailErr) {
    console.error("Recruitment status email dispatch failed:", mailErr);
  }

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

    const interviewerId = Array.isArray(payload.interviewer_ids)
      ? payload.interviewer_ids.filter(Boolean).join(",")
      : (emptyToNull(payload.interviewer_id) ??
        emptyToNull(payload.assigned_interviewer) ??
        null);

    let interviewerName = "TBA";

    if (interviewerId) {
      const ids = interviewerId.split(",").map((id) => id.trim());

      const [rows] = await connection.query(
        `
      SELECT
        employee_id,
        CONCAT_WS(' ', first_name, last_name) AS name
      FROM employees
      WHERE org_id = ?
        AND employee_id IN (?)
    `,
        [orgId, ids],
      );

      interviewerName = rows.map((r) => r.name).join(", ") || interviewerId;
    }

    const interviewDate = normalizeDateTime(payload.interview_date || null);
    const interviewLink = emptyToNull(payload.interview_link) ?? null;
    const sendInterviewEmail = Number(
      toBool(payload.send_interview_email) ? 1 : 0,
    );

    let { emailSubject, emailBody } = buildEmailDefaults({
      candidate,
      roundName,
      interviewerName,
      interviewDate,
      interviewLink,
      organization,
    });

    if (payload.email_subject) emailSubject = payload.email_subject;
    if (payload.email_body) emailBody = payload.email_body;

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

    const interviewerId = Array.isArray(payload.interviewer_ids)
      ? payload.interviewer_ids.filter(Boolean).join(",")
      : (emptyToNull(payload.interviewer_id) ??
        emptyToNull(payload.assigned_interviewer) ??
        latestAssessment?.interviewer_id ??
        null);

    let interviewerName = "TBA";

    if (interviewerId) {
      const ids = interviewerId.split(",").map((id) => id.trim());

      const [rows] = await connection.query(
        `
      SELECT
        employee_id,
        CONCAT_WS(' ', first_name, last_name) AS name
      FROM employees
      WHERE org_id = ?
        AND employee_id IN (?)
    `,
        [orgId, ids],
      );

      interviewerName = rows.map((r) => r.name).join(", ") || interviewerId;
    }

    const interviewDate = normalizeDateTime(
      payload.interview_date || latestAssessment?.interview_date || null,
    );

    const interviewLink =
      emptyToNull(payload.interview_link) ??
      latestAssessment?.interview_link ??
      null;

    const sendInterviewEmail = payload.hasOwnProperty("send_interview_email")
      ? Number(toBool(payload.send_interview_email) ? 1 : 0)
      : 0;

    // Build defaults, but allow overrides from payload (email_subject/email_body)
    let { emailSubject, emailBody } = buildEmailDefaults({
      candidate,
      roundName: baseRound,
      interviewerName,
      interviewDate,
      interviewLink,
      organization,
    });
    if (payload.email_subject) emailSubject = payload.email_subject;
    if (payload.email_body) emailBody = payload.email_body;

    const score = emptyToNull(payload.score) ?? latestAssessment?.score ?? null;
    const decision =
      emptyToNull(payload.decision) ??
      emptyToNull(payload.status) ??
      latestAssessment?.decision ??
      null;
    let feedback = latestAssessment?.feedback || null;

    if (payload.feedback) {
      feedback =
        typeof payload.feedback === "string"
          ? payload.feedback
          : JSON.stringify(payload.feedback);
    }

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
