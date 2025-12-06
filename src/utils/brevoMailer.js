const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

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
      const code = err.code || (err.response && err.response.status);
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

async function sendResetEmail(employeeEmail, employeeName) {
  if (!process.env.BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY not configured");
  }
  if (!process.env.BREVO_SENDER_EMAIL) {
    throw new Error("BREVO_SENDER_EMAIL not configured");
  }

  const resetToken = uuidv4();
  const resetLink = `${process.env.FRONTEND_URL}/ResetPassword?token=${resetToken}`;
  const tokenExpiry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const payload = {
    sender: {
      name: "SUKALPA TECH SOLUTIONS",
      email: process.env.BREVO_SENDER_EMAIL,
    },
    to: [
      {
        email: employeeEmail,
        name: employeeName,
      },
    ],
    subject: "Welcome to SUKALPA TECH SOLUTIONS – Set Up Your Account",
    htmlContent: `
      <p>Dear ${employeeName},</p>
      <p>Welcome to <strong>SUKALPA TECH SOLUTIONS</strong>! We're excited to have you join our team.</p>
      <h3>🔐 Reset Your Password</h3>
      <p>To activate your account, please reset your password using the link below:</p>
      <p><a href="${resetLink}" style="color: blue; text-decoration: underline; font-weight: bold;">👉 Reset Your Password</a></p>
      <p><strong>Note:</strong> This link will be valid for 3 days.</p>
      <p>Warm regards,<br/>SUKALPA TECH SOLUTIONS</p>
    `,
    textContent: `Dear ${employeeName},

Welcome to SUKALPA TECH SOLUTIONS!

Reset your password using:
${resetLink}

Note: This link will be valid for 3 days.

Warm regards,
SUKALPA TECH SOLUTIONS
`,
  };

  await sendWithRetries(payload);

  return { resetToken, tokenExpiry, resetLink };
}

module.exports = { sendResetEmail, sendWithRetries };
