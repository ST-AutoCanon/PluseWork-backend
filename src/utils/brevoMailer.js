// const nodemailer = require("nodemailer");
// const { v4: uuidv4 } = require("uuid");
// const axios = require("axios");
// const fs = require("fs");
// const path = require("path");

// const MAX_RETRIES = 2;
// const RETRY_BASE_MS = 500;

// if (!process.env.SMTP_HOST) {
//   console.warn("[mailer] WARNING: SMTP_HOST is not set.");
// }
// if (!process.env.SMTP_USER) {
//   console.warn("[mailer] WARNING: SMTP_USER is not set.");
// }
// if (!process.env.SMTP_PASS) {
//   console.warn("[mailer] WARNING: SMTP_PASS is not set.");
// }

// function sleep(ms) {
//   return new Promise((res) => setTimeout(res, ms));
// }

// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST,
//   port: Number(process.env.SMTP_PORT) || 587,
//   secure: false,
//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASS,
//   },
//   tls: {
//     rejectUnauthorized: false,
//   },
// });

// async function sendWithRetries(mailOptions, retries = MAX_RETRIES) {
//   let attempt = 0;
//   let lastErr = null;

//   while (attempt <= retries) {
//     try {
//       attempt++;
//       return await transporter.sendMail(mailOptions);
//     } catch (err) {
//       lastErr = err;

//       if (attempt > retries) break;

//       const wait = RETRY_BASE_MS * Math.pow(2, attempt - 1);
//       console.warn(
//         `[mailer] transient mail error (attempt ${attempt}). retrying in ${wait}ms`,
//         err && err.message ? err.message : err,
//       );
//       await sleep(wait);
//     }
//   }

//   throw lastErr;
// }

// async function fetchLogoDataUri(rawLogoUrl, localLogoPath) {
//   if (
//     rawLogoUrl &&
//     typeof rawLogoUrl === "string" &&
//     /^https?:\/\//i.test(rawLogoUrl)
//   ) {
//     try {
//       const r = await axios.get(rawLogoUrl, {
//         responseType: "arraybuffer",
//         maxRedirects: 5,
//         timeout: 10000,
//         headers: {
//           "User-Agent":
//             "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
//         },
//       });
//       const buf = Buffer.from(r.data);
//       const ct = (r.headers["content-type"] || "").split(";")[0];
//       if (ct && ct.startsWith("image/")) {
//         return `data:${ct};base64,${buf.toString("base64")}`;
//       }
//     } catch (_) {}
//   }

//   if (localLogoPath) {
//     try {
//       const filePath = path.isAbsolute(localLogoPath)
//         ? localLogoPath
//         : path.join(process.cwd(), localLogoPath);
//       if (fs.existsSync(filePath)) {
//         const buf = fs.readFileSync(filePath);
//         const ext = path.extname(filePath).toLowerCase().replace(".", "");
//         const mimeMap = {
//           png: "image/png",
//           jpg: "image/jpeg",
//           jpeg: "image/jpeg",
//           gif: "image/gif",
//           svg: "image/svg+xml",
//           webp: "image/webp",
//         };
//         const mime = mimeMap[ext] || "application/octet-stream";
//         if (mime.startsWith("image/")) {
//           return `data:${mime};base64,${buf.toString("base64")}`;
//         }
//       }
//     } catch (_) {}
//   }

//   return null;
// }

// async function sendResetEmail(employeeEmail, employeeName, opts = {}) {
//   const platformName =
//     opts.platformName || process.env.PLATFORM_NAME || "PULSEWORK";
//   const senderName =
//     process.env.SMTP_SENDER_NAME || platformName || "PULSEWORK";
//   const frontendBase = opts.frontendUrl || process.env.FRONTEND_URL || "";
//   const loginUrl = opts.loginUrl || `${frontendBase}/login`;
//   const supportEmail =
//     opts.supportEmail || process.env.SUPPORT_EMAIL || "info@sukalpatech.com";
//   const resetTtlHours = Number(
//     opts.resetTtlHours || process.env.RESET_TOKEN_TTL_HOURS || 72,
//   );

//   const coerceOptString = (v) => {
//     if (v == null) return null;
//     const s = String(v).trim();
//     if (!s) return null;
//     const low = s.toLowerCase();
//     if (low === "undefined" || low === "null") return null;
//     return s;
//   };

//   const orgName = coerceOptString(opts.orgName);
//   const inviterName = coerceOptString(opts.inviterName);
//   const role = (opts.role || "").toLowerCase();

//   const expiryMs = Number(resetTtlHours) * 60 * 60 * 1000;

//   const rawLogoUrl = (opts.logoUrl || process.env.MAIL_LOGO_URL || "")
//     .toString()
//     .trim();
//   const localLogoPath = opts.logoPath || process.env.MAIL_LOGO_PATH || null;

//   const resetToken = uuidv4();
//   const resetLink = `${frontendBase.replace(
//     /\/$/,
//     "",
//   )}/ResetPassword?token=${resetToken}`;
//   const tokenExpiry = new Date(Date.now() + expiryMs);

//   const esc = (s) =>
//     String(s || "")
//       .replace(/&/g, "&amp;")
//       .replace(/</g, "&lt;")
//       .replace(/>/g, "&gt;");

//   let logoSrc = rawLogoUrl || "";
//   try {
//     const embedded = await fetchLogoDataUri(rawLogoUrl, localLogoPath);
//     if (embedded) logoSrc = embedded;
//   } catch (_) {}

//   const footerHtml = `
//     <tr>
//       <td style="padding:16px 20px;background:#fafafa;text-align:center;">
//         ${
//           logoSrc
//             ? `<img src="${esc(logoSrc)}" alt="${esc(
//                 platformName,
//               )} logo" style="height:36px;margin-bottom:8px;display:block;margin-left:auto;margin-right:auto;">`
//             : ""
//         }
//         <div style="font-family:Helvetica,Arial,sans-serif;color:#555;font-size:13px;margin-top:6px;">
//           From the <strong>${esc(platformName)} Team</strong><br/>
//           <a href="mailto:${esc(
//             supportEmail,
//           )}" style="color:#2563eb;text-decoration:none;">${esc(
//             supportEmail,
//           )}</a>
//         </div>
//         <div style="font-family:Helvetica,Arial,sans-serif;color:#999;font-size:12px;margin-top:8px;">©2025 Sukalpa Tech. All rights reserved.</div>
//       </td>
//     </tr>
//   `;

//   const headerHtml = (titleHtml) => `
//     <tr>
//       <td style="padding:20px;text-align:center;background:#ffffff;">
//         ${
//           titleHtml ||
//           `<h2 style="margin:0;">Welcome to ${esc(platformName)}</h2>`
//         }
//       </td>
//     </tr>
//   `;

//   let subject = `Welcome to ${platformName} – Set Up Your Account`;
//   let htmlContent = "";
//   let textContent = "";

//   if (role === "admin") {
//     subject = `Welcome to ${platformName} — Set up your admin account for ${
//       orgName || ""
//     }`;

//     htmlContent = `<!doctype html>
//       <html>
//         <head><meta charset="utf-8" /></head>
//         <body style="font-family:Helvetica,Arial,sans-serif;color:#333;background:#f6f7fb;margin:0;padding:24px;">
//           <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
//             <tr>
//               <td style="padding:20px;text-align:center;background:#ffffff;">
//                 <h2 style="margin:0;">Welcome to ${esc(platformName)}</h2>
//                 ${
//                   orgName
//                     ? `<p style="margin:6px 0 0 0;color:#666;">${esc(
//                         orgName,
//                       )} — Admin account</p>`
//                     : ""
//                 }
//               </td>
//             </tr>
//             <tr>
//               <td style="padding:20px;">
//                 <p style="margin:0 0 12px 0;">Hi <strong>${esc(
//                   employeeName,
//                 )}</strong>,</p>
//                 <p style="margin:0 0 16px 0;">An administrator account has been created for <strong>${esc(
//                   orgName || "",
//                 )}</strong> using this email address.</p>

//                 <p style="text-align:center;margin:24px 0;">
//                   <a href="${resetLink}" style="display:inline-block;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;background:#2563eb;color:#fff;">
//                     Set your password
//                   </a>
//                 </p>

//                 <p style="color:#666;font-size:13px;margin-top:8px;">This link will expire in <strong>${resetTtlHours} hours</strong>. After setting your password you can log in at <a href="${loginUrl}">${loginUrl}</a>.</p>

//                 <p style="font-size:13px;color:#666;margin-top:10px;">If you did not expect this email, ignore it or contact <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
//               </td>
//             </tr>
//             ${footerHtml}
//           </table>
//         </body>
//       </html>`;

//     textContent = `Hello ${employeeName},

// An administrator account has been created for ${orgName || ""}.

// Set your password:
// ${resetLink}

// This link will expire in ${resetTtlHours} hours.
// Login: ${loginUrl}

// If you did not expect this email, contact ${supportEmail}.

// — ${platformName} Team
// `;
//   } else {
//     const orgDisplay = orgName || "the organization";
//     subject = `Welcome to ${orgDisplay} — Let’s Get You Started`;

//     htmlContent = `<!doctype html>
//       <html>
//         <head><meta charset="utf-8" /></head>
//         <body style="font-family:Helvetica,Arial,sans-serif;color:#333;background:#f6f7fb;margin:0;padding:24px;">
//           <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
//             ${headerHtml(
//               `<h3 style="margin:0;">Welcome to <strong>${esc(
//                 orgDisplay,
//               )}</strong></h3>
//                <p style="margin:6px 0 0 0;color:#666;">Your employee HR portal via ${esc(
//                  platformName,
//                )}</p>`,
//             )}
//             <tr>
//               <td style="padding:20px;">
//                 <p style="margin:0 0 12px 0;">
//                   Hi <strong>${esc(employeeName)}</strong>,
//                 </p>

//                 <p style="margin:0 0 12px 0;">
//                   Welcome to <strong>${esc(
//                     orgDisplay,
//                   )}</strong>! We’re glad to have you on board.
//                 </p>

//                 <p style="margin:0 0 16px 0;">
//                   The HR Team at <strong>${esc(
//                     orgDisplay,
//                   )}</strong> has created your employee account on the organization’s HR portal.
//                   This portal will help you manage your profile, access company information,
//                   track attendance, and stay connected with your workplace.
//                 </p>

//                 <p style="margin:0 0 16px 0;">
//                   To get started, please set your password using the button below:
//                 </p>

//                 <p style="text-align:center;margin:24px 0;">
//                   <a href="${resetLink}" style="display:inline-block;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;background:#2563eb;color:#fff;">
//                     Set your password
//                   </a>
//                 </p>

//                 <p style="color:#666;font-size:13px;margin-top:8px;">
//                   This link will expire in <strong>${resetTtlHours} hours</strong>.
//                   After setting your password, you can sign in anytime at
//                   <a href="${loginUrl}">${loginUrl}</a>.
//                 </p>

//                 <p style="font-size:13px;color:#666;margin-top:12px;">
//                   If you have any questions during onboarding, please reach out to
//                   <strong>${esc(orgDisplay)}</strong>’s HR Team.
//                   For technical assistance, contact us at
//                   <a href="mailto:${supportEmail}">${supportEmail}</a>.
//                 </p>

//                 <p style="margin-top:18px;">
//                   We wish you a smooth onboarding experience and great success in your journey with
//                   <strong>${esc(orgDisplay)}</strong>.
//                 </p>
//               </td>
//             </tr>
//             ${footerHtml}
//           </table>
//         </body>
//       </html>`;

//     textContent = `Hi ${employeeName},

// Welcome to ${orgDisplay}! We’re glad to have you on board.

// The HR Team at ${orgDisplay} has created your employee account on the organization’s HR portal.
// This portal will help you manage your profile, access company information, and stay connected with your workplace.

// To get started, please set your password using the link below:
// ${resetLink}

// This link will expire in ${resetTtlHours} hours.
// Once completed, you can log in at:
// ${loginUrl}

// If you have any questions during onboarding, please contact ${orgDisplay}'s HR Team.
// For technical support, reach us at ${supportEmail}.

// We wish you a smooth onboarding experience and great success with ${orgDisplay}.

// — ${platformName} Team
// `;
//   }

//   const mailOptions = {
//     from: `"${senderName}" <${process.env.SMTP_USER}>`,
//     to: {
//       address: employeeEmail,
//       name: employeeName,
//     },
//     subject,
//     html: htmlContent,
//     text: textContent,
//   };

//   await sendWithRetries(mailOptions);

//   return { resetToken, tokenExpiry, resetLink };
// }

// async function sendForgotPasswordEmail(employeeEmail, employeeName, opts = {}) {
//   const platformName =
//     opts.platformName || process.env.PLATFORM_NAME || "PULSEWORK";
//   const senderName =
//     process.env.SMTP_SENDER_NAME || platformName || "PULSEWORK";
//   const frontendBase = opts.frontendUrl || process.env.FRONTEND_URL || "";
//   const resetTtlHours = Number(
//     opts.resetTtlHours || process.env.RESET_TOKEN_TTL_HOURS || 72,
//   );
//   const supportEmail =
//     opts.supportEmail || process.env.SUPPORT_EMAIL || "info@sukalpatech.com";

//   const resetToken = uuidv4();
//   const resetLink = `${(frontendBase || "").replace(
//     /\/$/,
//     "",
//   )}/ResetPassword?token=${resetToken}`;
//   const tokenExpiry = new Date(
//     Date.now() + Number(resetTtlHours) * 60 * 60 * 1000,
//   );

//   const subject = `${platformName} — Password reset request`;
//   const esc = (s) =>
//     String(s || "")
//       .replace(/&/g, "&amp;")
//       .replace(/</g, "&lt;")
//       .replace(/>/g, "&gt;");

//   const textContent = `Hello ${employeeName},

// We received a request to reset the password for your ${platformName} account.

// Reset link:
// ${resetLink}

// This link will expire in ${resetTtlHours} hours.
// If you did not request a password reset, please ignore this email or contact support at ${supportEmail}.

// Regards,
// ${platformName} Support
// `;

//   const htmlContent = `
//     <!doctype html>
//     <html><head><meta charset="utf-8"/></head>
//     <body style="font-family:Helvetica,Arial,sans-serif;color:#333;background:#f6f7fb;margin:0;padding:24px;">
//       <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
//         <tr>
//           <td style="padding:20px;text-align:center;background:#ffffff;">
//             <h2 style="margin:0;">${esc(platformName)}</h2>
//           </td>
//         </tr>
//         <tr>
//           <td style="padding:20px;">
//             <p>Hi <strong>${esc(employeeName)}</strong>,</p>
//             <p>We received a request to reset your password. Click the button below to set a new password.</p>
//             <p style="text-align:center;margin:24px 0;">
//               <a href="${resetLink}" style="display:inline-block;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;background:#2563eb;color:#fff;">
//                 Reset your password
//               </a>
//             </p>
//             <p style="color:#666;font-size:13px;margin-top:8px;">
//               For your security, this link expires in <strong>${resetTtlHours} hours</strong>.
//             </p>
//             <p style="font-size:13px;color:#666;margin-top:12px;">
//               If you did not request this, no action is needed — your account is secure.
//               For assistance, contact <a href="mailto:${esc(
//                 supportEmail,
//               )}">${esc(supportEmail)}</a>.
//             </p>
//             <p style="margin-top:18px;">Regards,<br/><strong>${esc(
//               platformName,
//             )} Support</strong></p>
//           </td>
//         </tr>
//       </table>
//     </body>
//     </html>
//   `;

//   const mailOptions = {
//     from: `"${senderName}" <${process.env.SMTP_USER}>`,
//     to: {
//       address: employeeEmail,
//       name: employeeName,
//     },
//     subject,
//     html: htmlContent,
//     text: textContent,
//   };

//   await sendWithRetries(mailOptions);

//   return { resetToken, tokenExpiry, resetLink };
// }

// module.exports = { sendResetEmail, sendForgotPasswordEmail, sendWithRetries };

// const { v4: uuidv4 } = require("uuid");
// const SibApiV3Sdk = require("sib-api-v3-sdk");
// const axios = require("axios");
// const fs = require("fs");
// const path = require("path");

// const MAX_RETRIES = 2;
// const RETRY_BASE_MS = 500;

// /* ---------------- BREVO CONFIG ---------------- */

// if (!process.env.BREVO_API_KEY) {
//   console.warn("[mailer] WARNING: BREVO_API_KEY is not set.");
// }
// if (!process.env.BREVO_SENDER_EMAIL) {
//   console.warn("[mailer] WARNING: BREVO_SENDER_EMAIL is not set.");
// }

// const client = SibApiV3Sdk.ApiClient.instance;
// client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;
// const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

// function sleep(ms) {
//   return new Promise((res) => setTimeout(res, ms));
// }

// /* ---------------- RETRY WRAPPER ---------------- */

// async function sendWithRetries(payload, retries = MAX_RETRIES) {
//   let attempt = 0;
//   let lastErr = null;

//   while (attempt <= retries) {
//     try {
//       attempt++;
//       return await emailApi.sendTransacEmail(payload);
//     } catch (err) {
//       lastErr = err;

//       if (attempt > retries) break;

//       const wait = RETRY_BASE_MS * Math.pow(2, attempt - 1);
//       console.warn(
//         `[mailer] transient mail error (attempt ${attempt}). retrying in ${wait}ms`,
//         err?.response?.body || err.message,
//       );

//       await sleep(wait);
//     }
//   }

//   throw lastErr;
// }

// /* ---------------- LOGO FETCH (UNCHANGED) ---------------- */

// async function fetchLogoDataUri(rawLogoUrl, localLogoPath) {
//   if (rawLogoUrl && /^https?:\/\//i.test(rawLogoUrl)) {
//     try {
//       const r = await axios.get(rawLogoUrl, {
//         responseType: "arraybuffer",
//         timeout: 10000,
//       });
//       const buf = Buffer.from(r.data);
//       const ct = (r.headers["content-type"] || "").split(";")[0];
//       if (ct && ct.startsWith("image/")) {
//         return `data:${ct};base64,${buf.toString("base64")}`;
//       }
//     } catch (_) {}
//   }

//   if (localLogoPath) {
//     try {
//       const filePath = path.isAbsolute(localLogoPath)
//         ? localLogoPath
//         : path.join(process.cwd(), localLogoPath);

//       if (fs.existsSync(filePath)) {
//         const buf = fs.readFileSync(filePath);
//         const ext = path.extname(filePath).toLowerCase().replace(".", "");
//         const mimeMap = {
//           png: "image/png",
//           jpg: "image/jpeg",
//           jpeg: "image/jpeg",
//           gif: "image/gif",
//           svg: "image/svg+xml",
//           webp: "image/webp",
//         };
//         const mime = mimeMap[ext] || "application/octet-stream";
//         if (mime.startsWith("image/")) {
//           return `data:${mime};base64,${buf.toString("base64")}`;
//         }
//       }
//     } catch (_) {}
//   }

//   return null;
// }

// async function sendResetEmail(employeeEmail, employeeName, opts = {}) {
//   const platformName =
//     opts.platformName || process.env.PLATFORM_NAME || "PULSEWORK";
//   const senderName =
//     process.env.SMTP_SENDER_NAME || platformName || "PULSEWORK";
//   const frontendBase = opts.frontendUrl || process.env.FRONTEND_URL || "";
//   const loginUrl = opts.loginUrl || `${frontendBase}/login`;
//   const supportEmail =
//     opts.supportEmail || process.env.SUPPORT_EMAIL || "info@sukalpatech.com";
//   const resetTtlHours = Number(
//     opts.resetTtlHours || process.env.RESET_TOKEN_TTL_HOURS || 72,
//   );

//   const coerceOptString = (v) => {
//     if (v == null) return null;
//     const s = String(v).trim();
//     if (!s) return null;
//     const low = s.toLowerCase();
//     if (low === "undefined" || low === "null") return null;
//     return s;
//   };

//   const orgName = coerceOptString(opts.orgName);
//   const inviterName = coerceOptString(opts.inviterName);
//   const role = (opts.role || "").toLowerCase();

//   const expiryMs = Number(resetTtlHours) * 60 * 60 * 1000;

//   const rawLogoUrl = (opts.logoUrl || process.env.MAIL_LOGO_URL || "")
//     .toString()
//     .trim();
//   const localLogoPath = opts.logoPath || process.env.MAIL_LOGO_PATH || null;

//   const resetToken = uuidv4();
//   const resetLink = `${frontendBase.replace(
//     /\/$/,
//     "",
//   )}/ResetPassword?token=${resetToken}`;
//   const tokenExpiry = new Date(Date.now() + expiryMs);

//   const esc = (s) =>
//     String(s || "")
//       .replace(/&/g, "&amp;")
//       .replace(/</g, "&lt;")
//       .replace(/>/g, "&gt;");

//   let logoSrc = rawLogoUrl || "";
//   try {
//     const embedded = await fetchLogoDataUri(rawLogoUrl, localLogoPath);
//     if (embedded) logoSrc = embedded;
//   } catch (_) {}

//   const footerHtml = `
//     <tr>
//       <td style="padding:16px 20px;background:#fafafa;text-align:center;">
//         ${
//           logoSrc
//             ? `<img src="${esc(logoSrc)}" alt="${esc(
//                 platformName,
//               )} logo" style="height:36px;margin-bottom:8px;display:block;margin-left:auto;margin-right:auto;">`
//             : ""
//         }
//         <div style="font-family:Helvetica,Arial,sans-serif;color:#555;font-size:13px;margin-top:6px;">
//           From the <strong>${esc(platformName)} Team</strong><br/>
//           <a href="mailto:${esc(
//             supportEmail,
//           )}" style="color:#2563eb;text-decoration:none;">${esc(
//             supportEmail,
//           )}</a>
//         </div>
//         <div style="font-family:Helvetica,Arial,sans-serif;color:#999;font-size:12px;margin-top:8px;">©2025 Sukalpa Tech. All rights reserved.</div>
//       </td>
//     </tr>
//   `;

//   const headerHtml = (titleHtml) => `
//     <tr>
//       <td style="padding:20px;text-align:center;background:#ffffff;">
//         ${
//           titleHtml ||
//           `<h2 style="margin:0;">Welcome to ${esc(platformName)}</h2>`
//         }
//       </td>
//     </tr>
//   `;

//   let subject = `Welcome to ${platformName} – Set Up Your Account`;
//   let htmlContent = "";
//   let textContent = "";

//   if (role === "admin") {
//     subject = `Welcome to ${platformName} — Set up your admin account for ${
//       orgName || ""
//     }`;

//     htmlContent = `<!doctype html>
//       <html>
//         <head><meta charset="utf-8" /></head>
//         <body style="font-family:Helvetica,Arial,sans-serif;color:#333;background:#f6f7fb;margin:0;padding:24px;">
//           <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
//             <tr>
//               <td style="padding:20px;text-align:center;background:#ffffff;">
//                 <h2 style="margin:0;">Welcome to ${esc(platformName)}</h2>
//                 ${
//                   orgName
//                     ? `<p style="margin:6px 0 0 0;color:#666;">${esc(
//                         orgName,
//                       )} — Admin account</p>`
//                     : ""
//                 }
//               </td>
//             </tr>
//             <tr>
//               <td style="padding:20px;">
//                 <p style="margin:0 0 12px 0;">Hi <strong>${esc(
//                   employeeName,
//                 )}</strong>,</p>
//                 <p style="margin:0 0 16px 0;">An administrator account has been created for <strong>${esc(
//                   orgName || "",
//                 )}</strong> using this email address.</p>

//                 <p style="text-align:center;margin:24px 0;">
//                   <a href="${resetLink}" style="display:inline-block;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;background:#2563eb;color:#fff;">
//                     Set your password
//                   </a>
//                 </p>

//                 <p style="color:#666;font-size:13px;margin-top:8px;">This link will expire in <strong>${resetTtlHours} hours</strong>. After setting your password you can log in at <a href="${loginUrl}">${loginUrl}</a>.</p>

//                 <p style="font-size:13px;color:#666;margin-top:10px;">If you did not expect this email, ignore it or contact <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
//               </td>
//             </tr>
//             ${footerHtml}
//           </table>
//         </body>
//       </html>`;

//     textContent = `Hello ${employeeName},

// An administrator account has been created for ${orgName || ""}.

// Set your password:
// ${resetLink}

// This link will expire in ${resetTtlHours} hours.
// Login: ${loginUrl}

// If you did not expect this email, contact ${supportEmail}.

// — ${platformName} Team
// `;
//   } else {
//     const orgDisplay = orgName || "the organization";
//     subject = `Welcome to ${orgDisplay} — Let’s Get You Started`;

//     htmlContent = `<!doctype html>
//       <html>
//         <head><meta charset="utf-8" /></head>
//         <body style="font-family:Helvetica,Arial,sans-serif;color:#333;background:#f6f7fb;margin:0;padding:24px;">
//           <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
//             ${headerHtml(
//               `<h3 style="margin:0;">Welcome to <strong>${esc(
//                 orgDisplay,
//               )}</strong></h3>
//                <p style="margin:6px 0 0 0;color:#666;">Your employee HR portal via ${esc(
//                  platformName,
//                )}</p>`,
//             )}
//             <tr>
//               <td style="padding:20px;">
//                 <p style="margin:0 0 12px 0;">
//                   Hi <strong>${esc(employeeName)}</strong>,
//                 </p>

//                 <p style="margin:0 0 12px 0;">
//                   Welcome to <strong>${esc(
//                     orgDisplay,
//                   )}</strong>! We’re glad to have you on board.
//                 </p>

//                 <p style="margin:0 0 16px 0;">
//                   The HR Team at <strong>${esc(
//                     orgDisplay,
//                   )}</strong> has created your employee account on the organization’s HR portal.
//                   This portal will help you manage your profile, access company information,
//                   track attendance, and stay connected with your workplace.
//                 </p>

//                 <p style="margin:0 0 16px 0;">
//                   To get started, please set your password using the button below:
//                 </p>

//                 <p style="text-align:center;margin:24px 0;">
//                   <a href="${resetLink}" style="display:inline-block;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;background:#2563eb;color:#fff;">
//                     Set your password
//                   </a>
//                 </p>

//                 <p style="color:#666;font-size:13px;margin-top:8px;">
//                   This link will expire in <strong>${resetTtlHours} hours</strong>.
//                   After setting your password, you can sign in anytime at
//                   <a href="${loginUrl}">${loginUrl}</a>.
//                 </p>

//                 <p style="font-size:13px;color:#666;margin-top:12px;">
//                   If you have any questions during onboarding, please reach out to
//                   <strong>${esc(orgDisplay)}</strong>’s HR Team.
//                   For technical assistance, contact us at
//                   <a href="mailto:${supportEmail}">${supportEmail}</a>.
//                 </p>

//                 <p style="margin-top:18px;">
//                   We wish you a smooth onboarding experience and great success in your journey with
//                   <strong>${esc(orgDisplay)}</strong>.
//                 </p>
//               </td>
//             </tr>
//             ${footerHtml}
//           </table>
//         </body>
//       </html>`;

//     textContent = `Hi ${employeeName},

// Welcome to ${orgDisplay}! We’re glad to have you on board.

// The HR Team at ${orgDisplay} has created your employee account on the organization’s HR portal.
// This portal will help you manage your profile, access company information, and stay connected with your workplace.

// To get started, please set your password using the link below:
// ${resetLink}

// This link will expire in ${resetTtlHours} hours.
// Once completed, you can log in at:
// ${loginUrl}

// If you have any questions during onboarding, please contact ${orgDisplay}'s HR Team.
// For technical support, reach us at ${supportEmail}.

// We wish you a smooth onboarding experience and great success with ${orgDisplay}.

// — ${platformName} Team
// `;
//   }

//   await sendWithRetries({
//     sender: {
//       email: process.env.BREVO_SENDER_EMAIL,
//       name: senderName,
//     },
//     to: [
//       {
//         email: employeeEmail,
//         name: employeeName,
//       },
//     ],
//     subject,
//     htmlContent,
//     textContent,
//   });

//   return { resetToken, tokenExpiry, resetLink };
// }

// async function sendForgotPasswordEmail(employeeEmail, employeeName, opts = {}) {
//   const platformName =
//     opts.platformName || process.env.PLATFORM_NAME || "PULSEWORK";
//   const senderName =
//     process.env.SMTP_SENDER_NAME || platformName || "PULSEWORK";
//   const frontendBase = opts.frontendUrl || process.env.FRONTEND_URL || "";
//   const resetTtlHours = Number(
//     opts.resetTtlHours || process.env.RESET_TOKEN_TTL_HOURS || 72,
//   );
//   const supportEmail =
//     opts.supportEmail || process.env.SUPPORT_EMAIL || "info@sukalpatech.com";

//   const resetToken = uuidv4();
//   const resetLink = `${(frontendBase || "").replace(
//     /\/$/,
//     "",
//   )}/ResetPassword?token=${resetToken}`;
//   const tokenExpiry = new Date(
//     Date.now() + Number(resetTtlHours) * 60 * 60 * 1000,
//   );

//   const subject = `${platformName} — Password reset request`;
//   const esc = (s) =>
//     String(s || "")
//       .replace(/&/g, "&amp;")
//       .replace(/</g, "&lt;")
//       .replace(/>/g, "&gt;");

//   const textContent = `Hello ${employeeName},

// We received a request to reset the password for your ${platformName} account.

// Reset link:
// ${resetLink}

// This link will expire in ${resetTtlHours} hours.
// If you did not request a password reset, please ignore this email or contact support at ${supportEmail}.

// Regards,
// ${platformName} Support
// `;

//   const htmlContent = `
//     <!doctype html>
//     <html><head><meta charset="utf-8"/></head>
//     <body style="font-family:Helvetica,Arial,sans-serif;color:#333;background:#f6f7fb;margin:0;padding:24px;">
//       <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
//         <tr>
//           <td style="padding:20px;text-align:center;background:#ffffff;">
//             <h2 style="margin:0;">${esc(platformName)}</h2>
//           </td>
//         </tr>
//         <tr>
//           <td style="padding:20px;">
//             <p>Hi <strong>${esc(employeeName)}</strong>,</p>
//             <p>We received a request to reset your password. Click the button below to set a new password.</p>
//             <p style="text-align:center;margin:24px 0;">
//               <a href="${resetLink}" style="display:inline-block;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;background:#2563eb;color:#fff;">
//                 Reset your password
//               </a>
//             </p>
//             <p style="color:#666;font-size:13px;margin-top:8px;">
//               For your security, this link expires in <strong>${resetTtlHours} hours</strong>.
//             </p>
//             <p style="font-size:13px;color:#666;margin-top:12px;">
//               If you did not request this, no action is needed — your account is secure.
//               For assistance, contact <a href="mailto:${esc(
//                 supportEmail,
//               )}">${esc(supportEmail)}</a>.
//             </p>
//             <p style="margin-top:18px;">Regards,<br/><strong>${esc(
//               platformName,
//             )} Support</strong></p>
//           </td>
//         </tr>
//       </table>
//     </body>
//     </html>
//   `;

//   await sendWithRetries({
//     sender: {
//       email: process.env.BREVO_SENDER_EMAIL,
//       name: senderName,
//     },
//     to: [
//       {
//         email: employeeEmail,
//         name: employeeName,
//       },
//     ],
//     subject,
//     htmlContent,
//     textContent,
//   });

//   return { resetToken, tokenExpiry, resetLink };
// }

// module.exports = { sendResetEmail, sendForgotPasswordEmail, sendWithRetries };

const { v4: uuidv4 } = require("uuid");
const SibApiV3Sdk = require("sib-api-v3-sdk");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
// FORCE IPv4 - Fixes ETIMEDOUT
const https = require("https");
https.globalAgent.options.family = 4;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 500;

/* ---------------- BREVO CONFIG ---------------- */

if (!process.env.BREVO_API_KEY) {
  console.warn("[mailer] WARNING: BREVO_API_KEY is not set.");
}
if (!process.env.BREVO_SENDER_EMAIL) {
  console.warn("[mailer] WARNING: BREVO_SENDER_EMAIL is not set.");
}

const client = SibApiV3Sdk.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;
const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

/* ---------------- RETRY WRAPPER ---------------- */

async function sendWithRetries(payload, retries = MAX_RETRIES) {
  let attempt = 0;
  let lastErr = null;

  while (attempt <= retries) {
    try {
      attempt++;
      const result = await emailApi.sendTransacEmail(payload);
      console.log(`[mailer] Email sent successfully (attempt ${attempt})`);
      return result;
    } catch (err) {
      lastErr = err;
      const errorBody = err?.response?.body || err.message;

      console.warn(`[mailer] Attempt ${attempt} failed:`, errorBody);

      // Special handling for IP authorization error
      if (
        errorBody?.code === "unauthorized" &&
        errorBody?.message?.includes("IP address")
      ) {
        console.error(
          "❌ BREVO IP NOT WHITELISTED. Please add it in Brevo dashboard.",
        );
      }

      if (attempt > retries) break;

      const wait = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      await sleep(wait);
    }
  }

  console.error("[mailer] All retry attempts failed");
  throw lastErr;
}

/* ---------------- LOGO FETCH (UNCHANGED) ---------------- */

async function fetchLogoDataUri(rawLogoUrl, localLogoPath) {
  if (rawLogoUrl && /^https?:\/\//i.test(rawLogoUrl)) {
    try {
      const r = await axios.get(rawLogoUrl, {
        responseType: "arraybuffer",
        timeout: 10000,
      });
      const buf = Buffer.from(r.data);
      const ct = (r.headers["content-type"] || "").split(";")[0];
      if (ct && ct.startsWith("image/")) {
        return `data:${ct};base64,${buf.toString("base64")}`;
      }
    } catch (_) {}
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
      }
    } catch (_) {}
  }

  return null;
}

async function sendResetEmail(employeeEmail, employeeName, opts = {}) {
  const platformName =
    opts.platformName || process.env.PLATFORM_NAME || "PULSEWORK";
  const senderName =
    process.env.SMTP_SENDER_NAME || platformName || "PULSEWORK";
  const frontendBase = opts.frontendUrl || process.env.FRONTEND_URL || "";
  const loginUrl = opts.loginUrl || `${frontendBase}/login`;
  const supportEmail =
    opts.supportEmail || process.env.SUPPORT_EMAIL || "info@sukalpatech.com";
  const resetTtlHours = Number(
    opts.resetTtlHours || process.env.RESET_TOKEN_TTL_HOURS || 72,
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

  const rawLogoUrl = (opts.logoUrl || process.env.MAIL_LOGO_URL || "")
    .toString()
    .trim();
  const localLogoPath = opts.logoPath || process.env.MAIL_LOGO_PATH || null;

  const resetToken = uuidv4();
  const resetLink = `${frontendBase.replace(
    /\/$/,
    "",
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
  } catch (_) {}

  const footerHtml = `
    <tr>
      <td style="padding:16px 20px;background:#fafafa;text-align:center;">
        ${
          logoSrc
            ? `<img src="${esc(logoSrc)}" alt="${esc(
                platformName,
              )} logo" style="height:36px;margin-bottom:8px;display:block;margin-left:auto;margin-right:auto;">`
            : ""
        }
        <div style="font-family:Helvetica,Arial,sans-serif;color:#555;font-size:13px;margin-top:6px;">
          From the <strong>${esc(platformName)} Team</strong><br/>
          <a href="mailto:${esc(
            supportEmail,
          )}" style="color:#2563eb;text-decoration:none;">${esc(
            supportEmail,
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

    htmlContent = `<!doctype html>
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
                        orgName,
                      )} — Admin account</p>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:20px;">
                <p style="margin:0 0 12px 0;">Hi <strong>${esc(
                  employeeName,
                )}</strong>,</p>
                <p style="margin:0 0 16px 0;">An administrator account has been created for <strong>${esc(
                  orgName || "",
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
      </html>`;

    textContent = `Hello ${employeeName},

An administrator account has been created for ${orgName || ""}.

Set your password:
${resetLink}

This link will expire in ${resetTtlHours} hours.
Login: ${loginUrl}

If you did not expect this email, contact ${supportEmail}.

— ${platformName} Team
`;
  } else {
    const orgDisplay = orgName || "the organization";
    subject = `Welcome to ${orgDisplay} — Let’s Get You Started`;

    htmlContent = `<!doctype html>
      <html>
        <head><meta charset="utf-8" /></head>
        <body style="font-family:Helvetica,Arial,sans-serif;color:#333;background:#f6f7fb;margin:0;padding:24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
            ${headerHtml(
              `<h3 style="margin:0;">Welcome to <strong>${esc(
                orgDisplay,
              )}</strong></h3>
               <p style="margin:6px 0 0 0;color:#666;">Your employee HR portal via ${esc(
                 platformName,
               )}</p>`,
            )}
            <tr>
              <td style="padding:20px;">
                <p style="margin:0 0 12px 0;">
                  Hi <strong>${esc(employeeName)}</strong>,
                </p>

                <p style="margin:0 0 12px 0;">
                  Welcome to <strong>${esc(
                    orgDisplay,
                  )}</strong>! We’re glad to have you on board.
                </p>

                <p style="margin:0 0 16px 0;">
                  The HR Team at <strong>${esc(
                    orgDisplay,
                  )}</strong> has created your employee account on the organization’s HR portal.
                  This portal will help you manage your profile, access company information,
                  track attendance, and stay connected with your workplace.
                </p>

                <p style="margin:0 0 16px 0;">
                  To get started, please set your password using the button below:
                </p>

                <p style="text-align:center;margin:24px 0;">
                  <a href="${resetLink}" style="display:inline-block;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;background:#2563eb;color:#fff;">
                    Set your password
                  </a>
                </p>

                <p style="color:#666;font-size:13px;margin-top:8px;">
                  This link will expire in <strong>${resetTtlHours} hours</strong>.
                  After setting your password, you can sign in anytime at
                  <a href="${loginUrl}">${loginUrl}</a>.
                </p>

                <p style="font-size:13px;color:#666;margin-top:12px;">
                  If you have any questions during onboarding, please reach out to
                  <strong>${esc(orgDisplay)}</strong>’s HR Team.
                  For technical assistance, contact us at
                  <a href="mailto:${supportEmail}">${supportEmail}</a>.
                </p>

                <p style="margin-top:18px;">
                  We wish you a smooth onboarding experience and great success in your journey with
                  <strong>${esc(orgDisplay)}</strong>.
                </p>
              </td>
            </tr>
            ${footerHtml}
          </table>
        </body>
      </html>`;

    textContent = `Hi ${employeeName},

Welcome to ${orgDisplay}! We’re glad to have you on board.

The HR Team at ${orgDisplay} has created your employee account on the organization’s HR portal.
This portal will help you manage your profile, access company information, and stay connected with your workplace.

To get started, please set your password using the link below:
${resetLink}

This link will expire in ${resetTtlHours} hours.
Once completed, you can log in at:
${loginUrl}

If you have any questions during onboarding, please contact ${orgDisplay}'s HR Team.
For technical support, reach us at ${supportEmail}.

We wish you a smooth onboarding experience and great success with ${orgDisplay}.

— ${platformName} Team
`;
  }

  await sendWithRetries({
    sender: {
      email: process.env.BREVO_SENDER_EMAIL,
      name: senderName,
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
  });

  return { resetToken, tokenExpiry, resetLink };
}

async function sendForgotPasswordEmail(employeeEmail, employeeName, opts = {}) {
  const platformName =
    opts.platformName || process.env.PLATFORM_NAME || "PULSEWORK";
  const senderName =
    process.env.SMTP_SENDER_NAME || platformName || "PULSEWORK";
  const frontendBase = opts.frontendUrl || process.env.FRONTEND_URL || "";
  const resetTtlHours = Number(
    opts.resetTtlHours || process.env.RESET_TOKEN_TTL_HOURS || 72,
  );
  const supportEmail =
    opts.supportEmail || process.env.SUPPORT_EMAIL || "info@sukalpatech.com";

  const resetToken = uuidv4();
  const resetLink = `${(frontendBase || "").replace(
    /\/$/,
    "",
  )}/ResetPassword?token=${resetToken}`;
  const tokenExpiry = new Date(
    Date.now() + Number(resetTtlHours) * 60 * 60 * 1000,
  );

  const subject = `${platformName} — Password reset request`;
  const esc = (s) =>
    String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const textContent = `Hello ${employeeName},

We received a request to reset the password for your ${platformName} account.

Reset link:
${resetLink}

This link will expire in ${resetTtlHours} hours.
If you did not request a password reset, please ignore this email or contact support at ${supportEmail}.

Regards,
${platformName} Support
`;

  const htmlContent = `
    <!doctype html>
    <html><head><meta charset="utf-8"/></head>
    <body style="font-family:Helvetica,Arial,sans-serif;color:#333;background:#f6f7fb;margin:0;padding:24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="padding:20px;text-align:center;background:#ffffff;">
            <h2 style="margin:0;">${esc(platformName)}</h2>
          </td>
        </tr>
        <tr>
          <td style="padding:20px;">
            <p>Hi <strong>${esc(employeeName)}</strong>,</p>
            <p>We received a request to reset your password. Click the button below to set a new password.</p>
            <p style="text-align:center;margin:24px 0;">
              <a href="${resetLink}" style="display:inline-block;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;background:#2563eb;color:#fff;">
                Reset your password
              </a>
            </p>
            <p style="color:#666;font-size:13px;margin-top:8px;">
              For your security, this link expires in <strong>${resetTtlHours} hours</strong>.
            </p>
            <p style="font-size:13px;color:#666;margin-top:12px;">
              If you did not request this, no action is needed — your account is secure.
              For assistance, contact <a href="mailto:${esc(
                supportEmail,
              )}">${esc(supportEmail)}</a>.
            </p>
            <p style="margin-top:18px;">Regards,<br/><strong>${esc(
              platformName,
            )} Support</strong></p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await sendWithRetries({
    sender: {
      email: process.env.BREVO_SENDER_EMAIL,
      name: senderName,
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
  });

  return { resetToken, tokenExpiry, resetLink };
}

module.exports = { sendResetEmail, sendForgotPasswordEmail, sendWithRetries };
