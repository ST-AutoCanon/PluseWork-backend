const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

const MAX_RETRIES = 2;
const RETRY_BASE_MS = 500;

if (!process.env.BREVO_API_KEY) {
  console.warn("[brevoMailer] WARNING: BREVO_API_KEY is not set.");
}
if (!process.env.BREVO_SENDER_EMAIL) {
  console.warn("[brevoMailer] WARNING: BREVO_SENDER_EMAIL is not set.");
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function sendWithRetries(payload, retries = MAX_RETRIES) {
  let attempt = 0;
  let lastErr = null;

  const url = "https://api.brevo.com/v3/smtp/email";
  const headers = {
    "api-key": process.env.BREVO_API_KEY,
    "content-type": "application/json",
    accept: "application/json",
  };

  while (attempt <= retries) {
    try {
      attempt++;
      const resp = await axios.post(url, payload, { headers, timeout: 10000 });
      return resp.data;
    } catch (err) {
      lastErr = err;
      const isTransient =
        err.code === "ECONNRESET" ||
        err.code === "ECONNREFUSED" ||
        (err.response && err.response.status >= 500);

      if (!isTransient || attempt > retries) break;

      const wait = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      console.warn(
        `[brevoMailer] transient mail error (attempt ${attempt}). retrying in ${wait}ms`,
        err && err.message ? err.message : err
      );
      await sleep(wait);
    }
  }

  if (lastErr && lastErr.response && lastErr.response.data) {
    const info = JSON.stringify(lastErr.response.data);
    lastErr.message = `${lastErr.message} | brevo response: ${info}`;
  }

  throw lastErr;
}

async function fetchLogoDataUri(rawLogoUrl, localLogoPath) {
  if (
    rawLogoUrl &&
    typeof rawLogoUrl === "string" &&
    /^https?:\/\//i.test(rawLogoUrl)
  ) {
    try {
      const r = await axios.get(rawLogoUrl, {
        responseType: "arraybuffer",
        maxRedirects: 5,
        timeout: 10000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      const buf = Buffer.from(r.data);
      const ct = (r.headers["content-type"] || "").split(";")[0];
      if (ct && ct.startsWith("image/")) {
        return `data:${ct};base64,${buf.toString("base64")}`;
      } else {
        console.warn(
          "[brevoMailer] remote logo fetch returned non-image content-type:",
          ct
        );
      }
    } catch (e) {
      console.warn(
        "[brevoMailer] remote logo fetch failed:",
        e && e.message ? e.message : e
      );
    }
  }

  if (localLogoPath) {
    try {
      const filePath = path.isAbsolute(localLogoPath)
        ? localLogoPath
        : path.join(process.cwd(), localLogoPath);
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase().replace(".", "");
        const mimeMap = {
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          gif: "image/gif",
          svg: "image/svg+xml",
          webp: "image/webp",
        };
        const mime = mimeMap[ext] || "application/octet-stream";
        if (mime.startsWith("image/")) {
          return `data:${mime};base64,${buf.toString("base64")}`;
        }
      } else {
        console.warn("[brevoMailer] local logo file does not exist:", filePath);
      }
    } catch (e) {
      console.warn(
        "[brevoMailer] reading local logo failed:",
        e && e.message ? e.message : e
      );
    }
  }

  return null;
}

async function sendResetEmail(employeeEmail, employeeName, opts = {}) {
  if (!process.env.BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY not configured");
  }
  if (!process.env.BREVO_SENDER_EMAIL) {
    throw new Error("BREVO_SENDER_EMAIL not configured");
  }

  const platformName =
    opts.platformName || process.env.PLATFORM_NAME || "PULSEWORK";
  const senderName =
    process.env.BREVO_SENDER_NAME || platformName || "PULSEWORK";
  const frontendBase = opts.frontendUrl || process.env.FRONTEND_URL || "";
  const loginUrl = opts.loginUrl || `${frontendBase}/login`;
  const supportEmail =
    opts.supportEmail || process.env.SUPPORT_EMAIL || "info@sukalpatech.com";
  const resetTtlHours = Number(
    opts.resetTtlHours || process.env.RESET_TOKEN_TTL_HOURS || 72
  );
  const coerceOptString = (v) => {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s) return null;
    const low = s.toLowerCase();
    if (low === "undefined" || low === "null") return null;
    return s;
  };

  const orgName = coerceOptString(opts.orgName);
  const inviterName = coerceOptString(opts.inviterName);
  const role = (opts.role || "").toLowerCase();

  const expiryMs = Number(resetTtlHours) * 60 * 60 * 1000;

  const rawLogoUrl = (opts.logoUrl || process.env.BREVO_LOGO_URL || "")
    .toString()
    .trim();
  const localLogoPath = opts.logoPath || process.env.BREVO_LOGO_PATH || null;

  const resetToken = uuidv4();
  const resetLink = `${frontendBase.replace(
    /\/$/,
    ""
  )}/ResetPassword?token=${resetToken}`;
  const tokenExpiry = new Date(Date.now() + expiryMs);

  const esc = (s) =>
    String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  let logoSrc = rawLogoUrl || "";
  try {
    const embedded = await fetchLogoDataUri(rawLogoUrl, localLogoPath);
    if (embedded) logoSrc = embedded;
  } catch (e) {
    console.warn(
      "[brevoMailer] logo embedding failed:",
      e && e.message ? e.message : e
    );
  }

  const footerHtml = `
    <tr>
      <td style="padding:16px 20px;background:#fafafa;text-align:center;">
        ${
          logoSrc
            ? `<img src="${esc(logoSrc)}" alt="${esc(
                platformName
              )} logo" style="height:36px;margin-bottom:8px;display:block;margin-left:auto;margin-right:auto;">`
            : ""
        }
        <div style="font-family:Helvetica,Arial,sans-serif;color:#555;font-size:13px;margin-top:6px;">
          From the <strong>${esc(platformName)} Team</strong><br/>
          <a href="mailto:${esc(
            supportEmail
          )}" style="color:#2563eb;text-decoration:none;">${esc(
    supportEmail
  )}</a>
        </div>
        <div style="font-family:Helvetica,Arial,sans-serif;color:#999;font-size:12px;margin-top:8px;">©2025 Sukalpa Tech. All rights reserved.</div>
      </td>
    </tr>
  `;

  const headerHtml = (titleHtml) => `
    <tr>
      <td style="padding:20px;text-align:center;background:#ffffff;">
        ${
          titleHtml ||
          `<h2 style="margin:0;">Welcome to ${esc(platformName)}</h2>`
        }
      </td>
    </tr>
  `;

  let subject = `Welcome to ${platformName} – Set Up Your Account`;
  let htmlContent = "";
  let textContent = "";

  if (role === "admin") {
    subject = `Welcome to ${platformName} — Set up your admin account for ${
      orgName || ""
    }`;

    htmlContent = `
      <!doctype html>
      <html>
        <head><meta charset="utf-8" /></head>
        <body style="font-family:Helvetica,Arial,sans-serif;color:#333;background:#f6f7fb;margin:0;padding:24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:20px;text-align:center;background:#ffffff;">
                <h2 style="margin:0;">Welcome to ${esc(platformName)}</h2>
                ${
                  orgName
                    ? `<p style="margin:6px 0 0 0;color:#666;">${esc(
                        orgName
                      )} — Admin account</p>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:20px;">
                <p style="margin:0 0 12px 0;">Hi <strong>${esc(
                  employeeName
                )}</strong>,</p>
                <p style="margin:0 0 16px 0;">An administrator account has been created for <strong>${esc(
                  orgName || ""
                )}</strong> using this email address.</p>

                <p style="text-align:center;margin:24px 0;">
                  <a href="${resetLink}" style="display:inline-block;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;background:#2563eb;color:#fff;">
                    Set your password
                  </a>
                </p>

                <p style="color:#666;font-size:13px;margin-top:8px;">This link will expire in <strong>${resetTtlHours} hours</strong>. After setting your password you can log in at <a href="${loginUrl}">${loginUrl}</a>.</p>

                <p style="font-size:13px;color:#666;margin-top:10px;">If you did not expect this email, ignore it or contact <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
              </td>
            </tr>
            ${footerHtml}
          </table>
        </body>
      </html>
    `;

    textContent = `Hello ${employeeName},

An administrator account has been created for ${orgName || ""}.

Set your password:
${resetLink}

This link will expire in ${resetTtlHours} hours.
Login: ${loginUrl}

If you did not expect this email, contact ${supportEmail}.

— ${platformName} Team
`;
  } else if (inviterName) {
    subject = `You’ve been invited to join ${
      orgName || "your organization"
    } on ${platformName} — Set your password`;

    htmlContent = `
      <!doctype html>
      <html>
        <head><meta charset="utf-8" /></head>
        <body style="font-family:Helvetica,Arial,sans-serif;color:#333;background:#f6f7fb;margin:0;padding:24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
            ${headerHtml(
              `<h3 style="margin:0;">You’ve been invited to <strong>${esc(
                orgName || ""
              )}</strong></h3><p style="margin:6px 0 0 0;color:#666;">via ${esc(
                platformName
              )}</p>`
            )}
            <tr>
              <td style="padding:20px;">
                <p style="margin:0 0 12px 0;">Hi <strong>${esc(
                  employeeName
                )}</strong>,</p>
                <p style="margin:0 0 16px 0;"><strong>${esc(
                  inviterName
                )}</strong> has added you to the organization's HR portal. To set your password and access your account, click below:</p>

                <p style="text-align:center;margin:24px 0;">
                  <a href="${resetLink}" style="display:inline-block;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;background:#2563eb;color:#fff;">
                    Set your password
                  </a>
                </p>

                <p style="color:#666;font-size:13px;margin-top:8px;">This link expires in <strong>${resetTtlHours} hours</strong>. After setting your password, sign in at <a href="${loginUrl}">${loginUrl}</a>.</p>

                <p style="font-size:13px;color:#666;margin-top:10px;">If you weren't expecting this invitation, please reach out to <strong>${esc(
                  inviterName
                )}</strong> or contact support at <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
              </td>
            </tr>
            ${footerHtml}
          </table>
        </body>
      </html>
    `;

    textContent = `Hello ${employeeName},

${inviterName} has added you to ${
      orgName || "the organization"
    } on ${platformName}.

Set your password:
${resetLink}

This link expires in ${resetTtlHours} hours.
Login: ${loginUrl}

If you didn't expect this invitation, contact ${inviterName} or ${supportEmail}.

— ${platformName} Team
`;
  } else {
    subject = `Set your ${platformName} password`;

    htmlContent = `
      <!doctype html><html><head><meta charset="utf-8" /></head><body style="font-family:Helvetica,Arial,sans-serif;color:#333;background:#f6f7fb;margin:0;padding:24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
          ${headerHtml()}
          <tr>
            <td style="padding:20px;text-align:center;">
              <p style="margin:0 0 12px 0;">Hi <strong>${esc(
                employeeName
              )}</strong>,</p>
              <p style="margin:0 0 16px 0;text-align:center;">
                <a href="${resetLink}" style="display:inline-block;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;background:#2563eb;color:#fff;">Set your password</a>
              </p>
            </td>
          </tr>
          ${footerHtml}
        </table>
      </body></html>
    `;

    textContent = `Set your password: ${resetLink}

— ${platformName} Team
`;
  }

  const payload = {
    sender: {
      name: senderName,
      email: process.env.BREVO_SENDER_EMAIL,
    },
    to: [
      {
        email: employeeEmail,
        name: employeeName,
      },
    ],
    subject,
    htmlContent,
    textContent,
  };

  await sendWithRetries(payload);

  return { resetToken, tokenExpiry, resetLink };
}

module.exports = { sendResetEmail, sendWithRetries };
