const { sendWithRetries } = require("../utils/brevoMailer");

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendVendorRegistrationEmail({ recipientEmail, vendorName, subject, body, link, username, password }) {
  if (!process.env.BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY not configured");
  }
  if (!process.env.BREVO_SENDER_EMAIL) {
    throw new Error("BREVO_SENDER_EMAIL not configured");
  }

  console.info("Sending vendor registration email", { recipientEmail, vendorName, link });
  await sendWithRetries({
    sender: {
      email: process.env.BREVO_SENDER_EMAIL,
      name: process.env.SMTP_SENDER_NAME || process.env.PLATFORM_NAME || "PULSEWORK",
    },
    to: [{ email: recipientEmail, name: vendorName }],
    subject,
    textContent: `${body}\n\nUsername: ${username}\nPassword: ${password}\n\nComplete the vendor registration here: ${link}\n\nThis link expires in 5 days and can be used once.`,
    htmlContent: `<div style="font-family:Arial,sans-serif;color:#202124;line-height:1.6">
      <p>${escapeHtml(body).replace(/\n/g, "<br />")}</p>
      <p><strong>Username:</strong> ${escapeHtml(username)}<br /><strong>Password:</strong> ${escapeHtml(password)}</p>
      <p><a href="${escapeHtml(link)}" style="display:inline-block;padding:11px 18px;background:#198754;color:#fff;text-decoration:none;border-radius:5px">Open Vendor Registration Form</a></p>
      <p style="font-size:13px;color:#5f6368">This secure link is for ${escapeHtml(vendorName)}, expires in 5 days, and can be used once.</p>
      <p style="font-size:12px;color:#5f6368;word-break:break-all">If the button does not work, use this link:<br />${escapeHtml(link)}</p>
    </div>`,
  });
}

async function sendVendorApprovalEmail({ recipientEmail, vendorName }) {
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    throw new Error("Brevo email configuration is incomplete");
  }

  await sendWithRetries({
    sender: {
      email: process.env.BREVO_SENDER_EMAIL,
      name:
        process.env.SMTP_SENDER_NAME ||
        process.env.PLATFORM_NAME ||
        "PULSEWORK",
    },

    to: [{ email: recipientEmail, name: vendorName }],

    subject: "Vendor Registration Approved",

    textContent: `Dear Team,

We have successfully completed the vendor registration process.

Thank you for your support and assistance throughout the process.

Best regards,
Sukalpa Finance`,

    htmlContent: `
      <div style="font-family:Arial,sans-serif;color:#202124;line-height:1.6">
        <p>Dear Team,</p>

        <p>
          We have successfully completed the vendor registration process.
        </p>

        <p>
          Thank you for your support and assistance throughout the process.
        </p>

        <p>
          Best regards,<br />
          Sukalpa Finance
        </p>
      </div>
    `,
  });
}
module.exports = { sendVendorRegistrationEmail, sendVendorApprovalEmail };
