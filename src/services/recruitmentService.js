const fs = require("fs/promises");
const path = require("path");
const { sendWithRetries } = require("../utils/mailer");
const { PDFParse } = require("pdf-parse");
const mammoth = require("mammoth");
const db = require("../config");
const crypto = require("crypto");

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

  GET_ASSESSMENT_FEEDBACK_BY_INTERVIEWER,
  INSERT_ASSESSMENT_FEEDBACK,
  UPDATE_ASSESSMENT_FEEDBACK,

  MARK_CONVERTED_TO_EMPLOYEE,
  INSERT_EMPLOYEE_FROM_RECRUITMENT,
  GET_RECRUITMENT_INTERVIEWERS,
  GET_ORGANIZATION_BY_ID,
  SET_OFFER_ACCEPTANCE_RESPONSE_TOKEN,
  GET_CANDIDATE_BY_OFFER_RESPONSE_TOKEN,
  SUBMIT_CANDIDATE_OFFER_RESPONSE,
  GET_RECRUITMENT_LETTERS,
  GET_RECRUITMENT_LETTER_BY_ID,
  INSERT_RECRUITMENT_LETTER,
  UPDATE_RECRUITMENT_LETTER,
  MARK_RECRUITMENT_LETTER_SENT,
  SET_ONBOARDING_DOCUMENT_TOKEN,
  GET_CANDIDATE_BY_ONBOARDING_TOKEN,
  MARK_ONBOARDING_DOCUMENTS_SUBMITTED,
  INSERT_RECRUITMENT_ONBOARDING_DOCUMENT,
  GET_RECRUITMENT_ONBOARDING_DOCUMENTS,
  GET_RECRUITMENT_ONBOARDING_DOCUMENT_BY_ID,
} = require("../constants/recruitmentQueries");

const REQUIRED_ONBOARDING_DOCUMENTS = [
  "PROFILE_PHOTO",
  "PAN_CARD",
  "ADDRESS_PROOF",
  "BANK_PROOF",
  "EDUCATION_CERTIFICATE",
];

const ALLOWED_ONBOARDING_DOCUMENTS = [
  ...REQUIRED_ONBOARDING_DOCUMENTS,
  "PREVIOUS_EMPLOYMENT_PROOF",
  "SALARY_SLIPS",
  "OTHER",
];

async function getPublicOnboardingFormService(orgId, rawToken) {
  const pool = await getTenantPoolForOrgId(orgId);
  const tokenHash = hashOnboardingToken(rawToken);

  const [rows] = await pool.query(GET_CANDIDATE_BY_ONBOARDING_TOKEN, [
    tokenHash,
    orgId,
  ]);

  const candidate = rows?.[0];

  if (!candidate) {
    const error = new Error(
      "This onboarding link is invalid, expired, or has already been submitted.",
    );
    error.code = "INVALID_ONBOARDING_TOKEN";
    throw error;
  }

  return {
    name: candidate.name,
    email: candidate.email,
    applied_position: candidate.applied_position,
  };
}

async function submitOnboardingDocumentsService(
  orgId,
  rawToken,
  documentTypes,
  files,
) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("Please upload the required onboarding documents.");
  }

  if (!Array.isArray(documentTypes) || documentTypes.length !== files.length) {
    throw new Error("Document information does not match the uploaded files.");
  }

  const normalizedTypes = documentTypes.map((type) =>
    String(type || "")
      .trim()
      .toUpperCase(),
  );

  if (
    normalizedTypes.some((type) => !ALLOWED_ONBOARDING_DOCUMENTS.includes(type))
  ) {
    throw new Error("An unsupported document category was submitted.");
  }

  const missingRequired = REQUIRED_ONBOARDING_DOCUMENTS.filter(
    (type) => !normalizedTypes.includes(type),
  );

  if (missingRequired.length > 0) {
    throw new Error(
      `Please upload all required documents. Missing: ${missingRequired.join(", ")}`,
    );
  }

  const pool = await getTenantPoolForOrgId(orgId);
  const connection = await pool.getConnection();
  const tokenHash = hashOnboardingToken(rawToken);

  try {
    await connection.beginTransaction();

    // Lock the candidate row to prevent two submissions racing on one token.
    const [candidateRows] = await connection.query(
      `${GET_CANDIDATE_BY_ONBOARDING_TOKEN} FOR UPDATE`,
      [tokenHash, orgId],
    );

    const candidate = candidateRows?.[0];

    if (!candidate) {
      const error = new Error(
        "This onboarding link is invalid, expired, or has already been submitted.",
      );
      error.code = "INVALID_ONBOARDING_TOKEN";
      throw error;
    }

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];

      await connection.query(INSERT_RECRUITMENT_ONBOARDING_DOCUMENT, [
        orgId,
        candidate.id,
        normalizedTypes[index],
        path.basename(file.originalname),
        path.basename(file.filename),
        file.mimetype,
        file.size,
      ]);
    }

    const [updateResult] = await connection.query(
      MARK_ONBOARDING_DOCUMENTS_SUBMITTED,
      [candidate.id, orgId, tokenHash],
    );

    if (!updateResult.affectedRows) {
      const error = new Error(
        "The onboarding submission could not be completed. Please reopen the link or contact HR.",
      );
      error.code = "ONBOARDING_SUBMISSION_FAILED";
      throw error;
    }

    await connection.commit();

    return {
      candidateId: candidate.id,
      submittedCount: files.length,
    };
  } catch (error) {
    await connection.rollback();

    // Remove uploaded files if the database transaction failed.
    await Promise.all(
      files.map((file) => fs.unlink(file.path).catch(() => {})),
    );

    throw error;
  } finally {
    connection.release();
  }
}

async function getRecruitmentOnboardingDocumentsService(candidateId, orgId) {
  const pool = await getTenantPoolForOrgId(orgId);

  const [rows] = await pool.query(GET_RECRUITMENT_ONBOARDING_DOCUMENTS, [
    candidateId,
    orgId,
  ]);

  return rows;
}

async function getRecruitmentOnboardingDocumentByIdService(
  candidateId,
  documentId,
  orgId,
) {
  const pool = await getTenantPoolForOrgId(orgId);

  const [rows] = await pool.query(GET_RECRUITMENT_ONBOARDING_DOCUMENT_BY_ID, [
    documentId,
    candidateId,
    orgId,
  ]);

  return rows?.[0] || null;
}

function emptyToNull(v) {
  if (v === "" || v === undefined) return null;
  return v;
}

function toBool(v) {
  return v === true || v === 1 || v === "1" || v === "true" || v === "TRUE";
}

function normalizeDateTime(value) {
  if (!value) return null;

  const isoLocalMatch = String(value)
    .trim()
    .match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/);
  if (isoLocalMatch) {
    const withSeconds =
      String(value).includes(":") && String(value).split(":").length >= 3;
    const base = String(value);
    return withSeconds ? base : `${base}:00`;
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).replace("T", " ");

  const pad = (n) => String(n).padStart(2, "0");

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

function escapeEmailHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailHtml(emailBody = "", options = {}) {
  const {
    organizationName = process.env.PLATFORM_NAME || "People & Culture",
    title = "Recruitment Update",
    preheader = "An update from our recruitment team.",
    ctaLabel = null,
    ctaUrl = null,
  } = options;

  const safeOrganization = escapeEmailHtml(organizationName);
  const safeTitle = escapeEmailHtml(title);
  const safePreheader = escapeEmailHtml(preheader);

  // Email bodies are plain text. Escape user-entered text before rendering HTML.
  const cleanBody = String(emailBody || "")
    .replace(/\{\{OFFER_RESPONSE_LINK\}\}/g, "")
    .replace(/\{\{ONBOARDING_FORM_LINK\}\}/g, "")
    .trim();

  const bodyHtml = cleanBody
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map(
      (paragraph) => `
        <p style="
          margin:0 0 18px;
          color:#334155;
          font-family:Arial,Helvetica,sans-serif;
          font-size:15px;
          line-height:1.75;
        ">
          ${escapeEmailHtml(paragraph).replace(/\n/g, "<br>")}
        </p>
      `,
    )
    .join("");

  const buttonHtml =
    ctaLabel && ctaUrl
      ? `
        <tr>
          <td align="center" style="padding:12px 0 26px;">
            <a
              href="${escapeEmailHtml(ctaUrl)}"
              target="_blank"
              style="
                display:inline-block;
                padding:15px 27px;
                background:#1d4ed8;
                color:#ffffff;
                font-family:Arial,Helvetica,sans-serif;
                font-size:14px;
                font-weight:700;
                text-decoration:none;
                border-radius:7px;
              "
            >${escapeEmailHtml(ctaLabel)}</a>
          </td>
        </tr>
      `
      : "";

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${safeTitle}</title>
      </head>
      <body style="
        margin:0;
        padding:0;
        background:#f1f5f9;
        -webkit-text-size-adjust:100%;
      ">
        <div style="
          display:none;
          max-height:0;
          overflow:hidden;
          opacity:0;
          color:transparent;
        ">${safePreheader}</div>

        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="background:#f1f5f9;width:100%;"
        >
          <tr>
            <td align="center" style="padding:32px 12px;">

              <table
                role="presentation"
                width="600"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                  width:100%;
                  max-width:600px;
                  background:#ffffff;
                  border-radius:12px;
                  overflow:hidden;
                  border:1px solid #e2e8f0;
                "
              >
                <tr>
                  <td style="
                    padding:27px 32px;
                    background:#172554;
                    border-bottom:4px solid #3b82f6;
                  ">
                    <div style="
                      color:#bfdbfe;
                      font-family:Arial,Helvetica,sans-serif;
                      font-size:11px;
                      font-weight:700;
                      letter-spacing:1.6px;
                      text-transform:uppercase;
                      margin-bottom:9px;
                    ">PEOPLE &amp; CULTURE</div>

                    <div style="
                      color:#ffffff;
                      font-family:Arial,Helvetica,sans-serif;
                      font-size:22px;
                      font-weight:700;
                      line-height:1.35;
                    ">${safeOrganization}</div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:32px 32px 12px;">
                    <h1 style="
                      margin:0 0 24px;
                      color:#0f172a;
                      font-family:Arial,Helvetica,sans-serif;
                      font-size:23px;
                      line-height:1.35;
                    ">${safeTitle}</h1>

                    ${bodyHtml}
                  </td>
                </tr>

                ${buttonHtml}

                <tr>
                  <td style="
                    padding:22px 32px;
                    background:#f8fafc;
                    border-top:1px solid #e2e8f0;
                  ">
                    <p style="
                      margin:0 0 8px;
                      color:#475569;
                      font-family:Arial,Helvetica,sans-serif;
                      font-size:12px;
                      line-height:1.6;
                    ">
                      This is an official communication from
                      ${safeOrganization}.
                    </p>

                    <p style="
                      margin:0;
                      color:#64748b;
                      font-family:Arial,Helvetica,sans-serif;
                      font-size:12px;
                      line-height:1.6;
                    ">
                      Please contact your HR team if you need assistance.
                      If a secure link has expired, request a new one from HR.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
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

function mapRecruitmentLetterRow(row) {
  const letter = { ...row };

  // Remove the recruitment-link fields from the nested Letterhead object.
  Object.keys(letter).forEach((key) => {
    if (key.startsWith("recruitment_")) {
      delete letter[key];
    }
  });

  return {
    id: row.recruitment_letter_id,
    org_id: row.recruitment_org_id,
    candidate_id: row.recruitment_candidate_id,
    letterhead_id: row.recruitment_letterhead_id,
    document_type: row.recruitment_document_type,
    status: row.recruitment_status,
    sent_to: row.recruitment_sent_to,
    sent_at: row.recruitment_sent_at,
    created_by: row.recruitment_created_by,
    created_at: row.recruitment_created_at,
    updated_at: row.recruitment_updated_at,

    // This is the actual letterhead_data row, including raw_content
    // and its saved dynamic field values.
    letter,
  };
}

async function getRecruitmentLettersService(orgId) {
  const pool = await getTenantPoolForOrgId(orgId);

  const [rows] = await pool.query(GET_RECRUITMENT_LETTERS, [orgId]);

  return rows.map(mapRecruitmentLetterRow);
}

async function createRecruitmentLetterService(
  candidateId,
  payload,
  orgId,
  createdBy,
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

    const documentType = String(payload.document_type || "").trim();

    if (!["OFFER_LETTER", "APPOINTMENT_LETTER"].includes(documentType)) {
      const err = new Error("Invalid recruitment document type");
      err.code = "INVALID_DOCUMENT_TYPE";
      throw err;
    }

    const letterheadId = Number(payload.letterhead_id);

    if (!letterheadId) {
      const err = new Error("letterhead_id is required");
      err.code = "LETTERHEAD_REQUIRED";
      throw err;
    }

    const [letterRows] = await connection.query(
      `
        SELECT id
        FROM letterhead_data
        WHERE id = ?
          AND org_id = ?
        LIMIT 1
      `,
      [letterheadId, orgId],
    );

    if (!letterRows.length) {
      const err = new Error("Letterhead not found");
      err.code = "LETTERHEAD_NOT_FOUND";
      throw err;
    }

    const [result] = await connection.query(INSERT_RECRUITMENT_LETTER, [
      orgId,
      candidateId,
      letterheadId,
      documentType,
      createdBy || null,
    ]);

    if (documentType === "OFFER_LETTER") {
      await connection.query(UPDATE_RECRUITMENT_STATUS, [
        "Offer Released",
        candidateId,
        orgId,
      ]);
    }

    await connection.commit();

    const [rows] = await pool.query(GET_RECRUITMENT_LETTER_BY_ID, [
      result.insertId,
      candidateId,
      orgId,
    ]);

    return rows[0] ? mapRecruitmentLetterRow(rows[0]) : null;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateRecruitmentLetterService(
  candidateId,
  recruitmentLetterId,
  payload,
  orgId,
) {
  const pool = await getTenantPoolForOrgId(orgId);

  const letterheadId = Number(payload.letterhead_id);

  if (!letterheadId) {
    throw new Error("letterhead_id is required");
  }

  const documentType = String(payload.document_type || "").trim();

  const [result] = await pool.query(UPDATE_RECRUITMENT_LETTER, [
    letterheadId,
    documentType,
    recruitmentLetterId,
    candidateId,
    orgId,
  ]);

  if (!result.affectedRows) {
    const err = new Error("Recruitment letter not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  const [rows] = await pool.query(GET_RECRUITMENT_LETTER_BY_ID, [
    recruitmentLetterId,
    candidateId,
    orgId,
  ]);

  return rows[0] ? mapRecruitmentLetterRow(rows[0]) : null;
}

async function sendRecruitmentLetterService(
  candidateId,
  recruitmentLetterId,
  orgId,
) {
  const pool = await getTenantPoolForOrgId(orgId);

  const [rows] = await pool.query(GET_RECRUITMENT_LETTER_BY_ID, [
    recruitmentLetterId,
    candidateId,
    orgId,
  ]);

  const document = rows?.[0];

  if (!document) {
    const err = new Error("Recruitment letter not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  const [candidateRows] = await pool.query(GET_RECRUITMENT_CANDIDATE_BY_ID, [
    candidateId,
    orgId,
  ]);

  const candidate = candidateRows?.[0];

  if (!candidate) {
    const err = new Error("Candidate not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  if (!candidate.email) {
    throw new Error("Candidate does not have an email address");
  }

  if (
    document.document_type === "OFFER_LETTER" &&
    candidate.offer_decision === "Accepted"
  ) {
    throw new Error("The candidate has already accepted the offer.");
  }

  if (
    document.document_type === "OFFER_LETTER" &&
    candidate.status === "Rejected"
  ) {
    throw new Error("Rejected candidates cannot receive an offer letter.");
  }

  if (!document.attachment) {
    throw new Error("The letter does not have a PDF attachment.");
  }

  const letterheadBaseDir = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "letterheadfiles",
  );

  const attachmentName = path.basename(document.attachment);

  const attachmentPath = path.join(
    letterheadBaseDir,
    `org_${String(orgId)}`,
    attachmentName,
  );

  const attachmentBuffer = await fs.readFile(attachmentPath);

  const organization = await getOrganizationById(orgId);

  let subject;
  let htmlBody;
  let textBody;

  let rawOfferToken = null;
  let offerTokenHash = null;
  let offerTokenExpiresAt = null;

  if (document.document_type === "OFFER_LETTER") {
    rawOfferToken = generateOfferResponseToken();
    offerTokenHash = hashOfferResponseToken(rawOfferToken);
    offerTokenExpiresAt = getOfferResponseTokenExpiry();

    const responseLink = buildOfferResponseLink(orgId, rawOfferToken);

    subject = `${organization?.name || "People & Culture"} | Your Offer Letter | ${candidate.name}`;

    textBody = `Dear ${candidate.name || "Candidate"},

Please find your offer letter attached for your review.

When you are ready, use the secure button in this email to submit your decision. You can accept the offer, raise a concern, or decline it.

If you have questions about the offer, please contact our HR team.

Warm regards,
People & Culture Team
${organization?.name || "People & Culture"}`;

    htmlBody = buildEmailHtml(textBody, {
      organizationName: organization?.name || "People & Culture",
      title: "Your Offer Letter",
      preheader: "Your offer letter is attached and ready for review.",
      ctaLabel: "Review & Respond to Offer",
      ctaUrl: responseLink,
    });
  } else {
    subject = `${organization?.name || "People & Culture"} | Your Appointment Letter | ${candidate.name}`;

    textBody = `Dear ${candidate.name || "Candidate"},

Congratulations on your appointment with ${organization?.name || "our organisation"}.

Please find your appointment letter attached. Kindly review the document and retain a copy for your records.

If you have questions or need clarification, please contact our HR team.

Warm regards,
People & Culture Team
${organization?.name || "People & Culture"}`;

    htmlBody = buildEmailHtml(textBody, {
      organizationName: organization?.name || "People & Culture",
      title: "Your Appointment Letter",
      preheader: "Your appointment letter is attached for your records.",
    });
  }

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
    subject,
    htmlContent: htmlBody,
    textContent: textBody,
    attachment: [
      {
        name:
          document.document_type === "OFFER_LETTER"
            ? "Offer-Letter.pdf"
            : "Appointment-Letter.pdf",
        content: attachmentBuffer.toString("base64"),
      },
    ],
  });

  await pool.query(MARK_RECRUITMENT_LETTER_SENT, [
    candidate.email,
    recruitmentLetterId,
    candidateId,
    orgId,
  ]);

  if (document.document_type === "OFFER_LETTER") {
    await pool.query(SET_OFFER_ACCEPTANCE_RESPONSE_TOKEN, [
      offerTokenHash,
      offerTokenExpiresAt,
      candidateId,
      orgId,
    ]);
  }

  const [updatedRows] = await pool.query(GET_RECRUITMENT_LETTER_BY_ID, [
    recruitmentLetterId,
    candidateId,
    orgId,
  ]);

  return {
    letter: updatedRows[0] ? mapRecruitmentLetterRow(updatedRows[0]) : null,
  };
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

function generateOfferResponseToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashOfferResponseToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function getOfferResponseTokenExpiry() {
  const ttlHours = Number(process.env.OFFER_RESPONSE_TOKEN_TTL_HOURS || 168);

  return new Date(Date.now() + ttlHours * 60 * 60 * 1000);
}

function buildOfferResponseLink(orgId, rawToken) {
  const frontendBase = String(process.env.FRONTEND_URL || "").replace(
    /\/$/,
    "",
  );

  return `${frontendBase}/OfferResponse?orgId=${encodeURIComponent(
    orgId,
  )}&token=${encodeURIComponent(rawToken)}`;
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
  const emailSubject = `${organization?.name || "Company"} | ${roundName} Interview`;

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
  const organizationName = organization?.name || "People & Culture";
  const candidateName = candidate?.name || "Candidate";
  const position = candidate?.applied_position || "the position discussed";

  if (newStatus === "Offer Acceptance") {
    return {
      subject: `${organizationName} | Offer Review Requested | ${candidateName}`,
      title: "Your Offer Is Ready for Review",
      preheader:
        "Please review your offer letter and submit your decision securely.",
      body: `Dear ${candidateName},

We are pleased to invite you to review the offer for ${position}.

Please review the offer details carefully and use the secure link below to submit your decision. You can accept the offer, raise a concern for our HR team to review, or decline it.

For your security, the response link is personal and time-limited. If the link has expired, please contact our HR team for assistance.

We appreciate your time and look forward to hearing from you.

Warm regards,
People & Culture Team
${organizationName}`,
    };
  }

  if (newStatus === "Onboarding") {
    return {
      subject: `${organizationName} | Onboarding Document Submission | ${candidateName}`,
      title: "Welcome to Onboarding",
      preheader:
        "Your next step is to securely submit your onboarding documents.",
      body: `Dear ${candidateName},

Congratulations on progressing to the onboarding stage for ${position}. We look forward to welcoming you to ${organizationName}.

To help us complete your onboarding records, please use the secure button below to submit the requested documents.

Documents to prepare:
• Recent passport-size photograph
• PAN card
• Government-issued identity or address proof, as required by company policy
• Bank proof, such as a cancelled cheque or bank passbook page
• Education certificates and marksheets
• Previous-employment documents, where applicable
• Recent salary slips, where applicable
• Any additional documents specifically requested by HR

Please upload clear, readable copies through the secure form rather than replying to this email with personal documents attached. Our HR team will review your submission and contact you if anything further is required.

Thank you for your cooperation.

Warm regards,
People & Culture Team
${organizationName}`,
    };
  }

  if (newStatus === "Offer Released") {
    return {
      subject: `${organizationName} | Offer Letter Update | ${candidateName}`,
      title: "Offer Letter Update",
      preheader: "An update regarding your employment offer.",
      body: `Dear ${candidateName},

Your offer letter is ready. Please review the attached document and contact our HR team if you have any questions.

Thank you for your interest in joining ${organizationName}.

Warm regards,
People & Culture Team
${organizationName}`,
    };
  }

  if (newStatus === "Offer Status") {
    return {
      subject: `${organizationName} | Offer Status Update | ${candidateName}`,
      title: "Offer Status Update",
      preheader: "An update regarding your offer.",
      body: `Dear ${candidateName},

Your offer status has been updated to ${normalizeOfferDecision(offerDecision) || "Pending"}.

Please contact our HR team if you need clarification or assistance.

Warm regards,
People & Culture Team
${organizationName}`,
    };
  }

  return {
    subject: `${organizationName} | Recruitment Update | ${candidateName}`,
    title: "Recruitment Update",
    preheader: "An update regarding your application.",
    body: `Dear ${candidateName},

We are contacting you with an update regarding your application for ${position}.

If you have any questions, please contact our HR team.

Warm regards,
People & Culture Team
${organizationName}`,
  };
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
  offerResponseLink = null,
  onboardingFormLink = null,
}) {
  if (!candidate?.email || !sendEmail) return;

  const organization = await getOrganizationById(orgId);

  const defaults = getRecruitmentStatusEmailContent({
    candidate,
    organization,
    newStatus,
    previousStatus,
    offerDecision,
  });

  if (!defaults) return;

  const subject = emailSubject || defaults.subject;
  const body = emailBody || defaults.body;

  let ctaLabel = null;
  let ctaUrl = null;

  if (newStatus === "Offer Acceptance" && offerResponseLink) {
    ctaLabel = "Review & Respond to Offer";
    ctaUrl = offerResponseLink;
  } else if (newStatus === "Onboarding" && onboardingFormLink) {
    ctaLabel = "Submit Onboarding Documents";
    ctaUrl = onboardingFormLink;
  }

  const cleanBody = String(body || "")
    .replace(/\{\{OFFER_RESPONSE_LINK\}\}/g, "")
    .replace(/\{\{ONBOARDING_FORM_LINK\}\}/g, "")
    .trim();

  const textContent = [cleanBody, ctaUrl ? `${ctaLabel}: ${ctaUrl}` : ""]
    .filter(Boolean)
    .join("\n\n");

  try {
    await sendWithRetries({
      sender: {
        email: process.env.BREVO_SENDER_EMAIL,
        name:
          organization?.name || process.env.PLATFORM_NAME || "People & Culture",
      },
      to: [
        {
          email: candidate.email,
          name: candidate.name,
        },
      ],
      subject,
      htmlContent: buildEmailHtml(cleanBody, {
        organizationName: organization?.name || "People & Culture",
        title: defaults.title || "Recruitment Update",
        preheader: defaults.preheader || subject,
        ctaLabel,
        ctaUrl,
      }),
      textContent,
    });
  } catch (mailErr) {
    console.error(
      "Recruitment status email send failed:",
      mailErr?.response?.body || mailErr,
    );
    throw mailErr;
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

  try {
    const requestedStatus = emptyToNull(payload.status);
    const nextStatus = requestedStatus ?? mapped.status;

    const shouldNotifyStatus =
      requestedStatus !== null &&
      (requestedStatus !== existing.status ||
        Object.prototype.hasOwnProperty.call(payload, "send_status_email"));

    const shouldSendStatusEmail =
      shouldNotifyStatus &&
      (Object.prototype.hasOwnProperty.call(payload, "send_status_email")
        ? toBool(payload.send_status_email)
        : true);

    let offerResponseLink = null;
    let onboardingFormLink = null;

    if (shouldNotifyStatus && nextStatus === "Offer Acceptance") {
      const offerToken = await issueOfferResponseToken(pool, id, orgId);
      offerResponseLink = offerToken.responseLink;
    }

    if (shouldSendStatusEmail && nextStatus === "Onboarding") {
      const onboardingToken = await issueOnboardingDocumentsToken(
        pool,
        id,
        orgId,
      );

      onboardingFormLink = onboardingToken.responseLink;
    }

    if (shouldNotifyStatus) {
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
        offerResponseLink,
        onboardingFormLink,
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

  let offerResponseLink = null;

  if (nextStatus === "Offer Acceptance") {
    const offerToken = await issueOfferResponseToken(pool, id, orgId);

    offerResponseLink = offerToken.responseLink;
  }

  try {
    let onboardingFormLink = null;

    if (nextStatus === "Onboarding") {
      const onboardingToken = await issueOnboardingDocumentsToken(
        pool,
        id,
        orgId,
      );

      onboardingFormLink = onboardingToken.responseLink;
    }

    await sendRecruitmentStatusEmail({
      candidate: {
        ...existing,
        status: nextStatus || existing.status || "Applied",
        email: existing.email,
        name: existing.name,
      },
      orgId,
      newStatus: nextStatus || existing.status || "Applied",
      previousStatus: existing.status || "Applied",
      offerDecision: payload.offer_decision,
      offerResponseLink,
      onboardingFormLink,
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

    const candidate = candidateRows[0];

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

    const interviewDate = normalizeDateTime(payload.interview_date);

    const interviewLink = emptyToNull(payload.interview_link);

    const sendInterviewEmail = Number(toBool(payload.send_interview_email));

    const interviewerIds = Array.isArray(payload.interviewer_ids)
      ? payload.interviewer_ids.filter(Boolean)
      : [];

    let interviewerName = "TBA";

    if (interviewerIds.length) {
      const [rows] = await connection.query(
        `
        SELECT
            employee_id,
            CONCAT_WS(' ',first_name,last_name) name
        FROM employees
        WHERE org_id=?
        AND employee_id IN (?)
        `,
        [orgId, interviewerIds],
      );

      interviewerName = rows.map((r) => r.name).join(", ") || "TBA";
    }

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
      interviewDate,
      interviewLink,
      sendInterviewEmail,
      emailBody,
      emailSubject,
    ]);

    const assessmentId = result.insertId;

    for (const interviewerId of interviewerIds) {
      await connection.query(
        `
        INSERT INTO recruitment_assessment_interviewers
        (
            assessment_id,
            interviewer_id
        )
        VALUES (?,?)
        `,
        [assessmentId, interviewerId],
      );
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
          htmlContent: buildEmailHtml(emailBody, {
            organizationName: organization?.name || "People & Culture",
            title: "Interview Scheduled",
            preheader: `Your ${roundName || "interview"} details are ready.`,
            ctaLabel: interviewLink ? "Join Interview" : null,
            ctaUrl: interviewLink || null,
          }),
          textContent: emailBody,
        });
      } catch (err) {
        console.error(err);
      }
    }

    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
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

  return rows[0] || null;
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

    const latestAssessment = await findAssessmentForUpdate(
      connection,
      candidateId,
      orgId,
      payload,
    );

    let assessmentId = latestAssessment?.id;

    if (!assessmentId) {
      const baseRound = roundFamilyName(roundName || payload.round_name || "");

      if (!baseRound) {
        const err = new Error("Round name is required");
        err.code = "ROUND_REQUIRED";
        throw err;
      }

      const [result] = await connection.query(INSERT_RECRUITMENT_ASSESSMENT, [
        candidateId,
        orgId,
        baseRound,
        null,
        null,
        0,
        null,
        null,
      ]);

      assessmentId = result.insertId;
    }

    const interviewerKey = emptyToNull(payload.interviewer_id);

    if (!interviewerKey) {
      const err = new Error("interviewer_id is required");
      err.code = "INTERVIEWER_REQUIRED";
      throw err;
    }

    const score = emptyToNull(payload.score);

    const decision =
      emptyToNull(payload.decision) ?? emptyToNull(payload.status);

    const feedback = emptyToNull(payload.feedback);

    const [existingFeedback] = await connection.query(
      GET_ASSESSMENT_FEEDBACK_BY_INTERVIEWER,
      [assessmentId, interviewerKey],
    );

    if (existingFeedback.length) {
      await connection.query(UPDATE_ASSESSMENT_FEEDBACK, [
        score,
        decision,
        feedback,
        assessmentId,
        interviewerKey,
      ]);
    } else {
      await connection.query(INSERT_ASSESSMENT_FEEDBACK, [
        assessmentId,
        candidateId,
        orgId,
        interviewerKey,
        score,
        decision,
        feedback,
      ]);
    }

    await connection.commit();

    return {
      affectedRows: 1,
      assessmentId,
      interviewerId: interviewerKey,
    };
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

async function issueOfferResponseToken(pool, candidateId, orgId) {
  const rawToken = generateOfferResponseToken();
  const tokenHash = hashOfferResponseToken(rawToken);
  const expiresAt = getOfferResponseTokenExpiry();

  await pool.query(SET_OFFER_ACCEPTANCE_RESPONSE_TOKEN, [
    tokenHash,
    expiresAt,
    candidateId,
    orgId,
  ]);

  return {
    rawToken,
    tokenHash,
    expiresAt,
    responseLink: buildOfferResponseLink(orgId, rawToken),
  };
}

async function getCandidateByOfferResponseTokenService(orgId, rawToken) {
  const pool = await getTenantPoolForOrgId(orgId);

  const tokenHash = hashOfferResponseToken(rawToken);

  const [rows] = await pool.query(GET_CANDIDATE_BY_OFFER_RESPONSE_TOKEN, [
    tokenHash,
    orgId,
  ]);

  const candidate = rows?.[0];

  if (!candidate) {
    const err = new Error("Invalid or expired offer response link.");
    err.code = "INVALID_OFFER_TOKEN";
    throw err;
  }

  if (candidate.status !== "Offer Acceptance") {
    const err = new Error("This offer response is no longer available.");
    err.code = "OFFER_RESPONSE_CLOSED";
    throw err;
  }

  if (
    !candidate.offer_response_token_expires_at ||
    new Date(candidate.offer_response_token_expires_at) < new Date()
  ) {
    const err = new Error("This offer response link has expired.");
    err.code = "OFFER_TOKEN_EXPIRED";
    throw err;
  }

  return candidate;
}

async function submitCandidateOfferResponseService(
  orgId,
  rawToken,
  decision,
  concern,
) {
  const normalizedDecision = String(decision || "").trim();

  const allowed = ["Accepted", "Concern", "Rejected"];

  if (!allowed.includes(normalizedDecision)) {
    const err = new Error("Invalid offer response.");
    err.code = "INVALID_OFFER_DECISION";
    throw err;
  }

  const cleanConcern = String(concern || "").trim();

  if (normalizedDecision === "Concern" && !cleanConcern) {
    const err = new Error("Please describe your concern.");
    err.code = "CONCERN_REQUIRED";
    throw err;
  }

  const pool = await getTenantPoolForOrgId(orgId);
  const tokenHash = hashOfferResponseToken(rawToken);

  const [candidateRows] = await pool.query(
    GET_CANDIDATE_BY_OFFER_RESPONSE_TOKEN,
    [tokenHash, orgId],
  );

  const candidate = candidateRows?.[0];

  if (!candidate) {
    const err = new Error("Invalid or expired offer response link.");
    err.code = "INVALID_OFFER_TOKEN";
    throw err;
  }

  if (candidate.status !== "Offer Acceptance") {
    const err = new Error("This offer response is already closed.");
    err.code = "OFFER_RESPONSE_CLOSED";
    throw err;
  }

  if (
    !candidate.offer_response_token_expires_at ||
    new Date(candidate.offer_response_token_expires_at) < new Date()
  ) {
    const err = new Error("This offer response link has expired.");
    err.code = "OFFER_TOKEN_EXPIRED";
    throw err;
  }

  const newStatus =
    normalizedDecision === "Rejected" ? "Rejected" : "Offer Acceptance";

  const [result] = await pool.query(SUBMIT_CANDIDATE_OFFER_RESPONSE, [
    newStatus,
    normalizedDecision,
    normalizedDecision === "Concern" ? cleanConcern : null,
    candidate.id,
    orgId,
    tokenHash,
  ]);

  if (!result.affectedRows) {
    const err = new Error("The offer response could not be submitted.");
    err.code = "OFFER_RESPONSE_NOT_UPDATED";
    throw err;
  }

  return {
    candidateId: candidate.id,
    decision: normalizedDecision,
    status: newStatus,
  };
}

function hashOnboardingToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function buildOnboardingDocumentsLink(orgId, rawToken) {
  const frontendBase = String(process.env.FRONTEND_URL || "").replace(
    /\/$/,
    "",
  );

  if (!frontendBase) {
    throw new Error("FRONTEND_URL is not configured.");
  }

  return `${frontendBase}/OnboardingDocuments?orgId=${encodeURIComponent(
    orgId,
  )}&token=${encodeURIComponent(rawToken)}`;
}

async function issueOnboardingDocumentsToken(pool, candidateId, orgId) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashOnboardingToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await pool.query(SET_ONBOARDING_DOCUMENT_TOKEN, [
    tokenHash,
    expiresAt,
    candidateId,
    orgId,
  ]);

  return {
    responseLink: buildOnboardingDocumentsLink(orgId, rawToken),
    expiresAt,
  };
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
  issueOfferResponseToken,
  getCandidateByOfferResponseTokenService,
  submitCandidateOfferResponseService,
  getRecruitmentLettersService,
  createRecruitmentLetterService,
  updateRecruitmentLetterService,
  sendRecruitmentLetterService,
  issueOnboardingDocumentsToken,
  getRecruitmentStatusEmailContent,
  sendRecruitmentStatusEmail,
};
