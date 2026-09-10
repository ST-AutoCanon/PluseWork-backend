
console.log("========== SMTP CONFIG ==========");
console.log("SMTP_HOST:", process.env.SMTP_HOST);
console.log("SMTP_PORT:", process.env.SMTP_PORT);
console.log("SMTP_SECURE:", process.env.SMTP_SECURE);
console.log("SMTP_USER:", process.env.SMTP_USER ? "SET" : "NOT SET");
console.log("SMTP_PASS:", process.env.SMTP_PASS ? "SET" : "NOT SET");
console.log("=================================");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== "false",
  },
  logger: process.env.LOG_SMTP === "true",
  debug: process.env.LOG_SMTP === "true",
});

transporter.verify((err, success) => {
  if (err) {
    console.error(
      "SMTP transporter verification failed:",
      err && err.message ? err.message : err
    );
    if (process.env.NODE_ENV !== "production") {
      console.error(err);
    }
  } else {
    console.info("SMTP transporter verified and ready to send messages");
  }
});

const sendNotificationEmail = async (createdOrPayload) => {
  const companyEmail = process.env.COMPANY_NOTIFY_EMAIL;
  if (!companyEmail) {
    throw new Error("COMPANY_NOTIFY_EMAIL not configured");
  }

  const payload = createdOrPayload?.payload || createdOrPayload;
  let subject = "New Demo Request";
  let bodyHtml = "<p>A new demo request has been submitted.</p>";

  if (payload && payload.name) {
    subject = `Demo Request from ${payload.name}`;
    const preferred = payload.preferredDate
      ? payload.preferredDate
      : "Not provided";
    bodyHtml = `
      <h3>New Demo Request</h3>
      <ul>
        <li><strong>Name:</strong> ${escapeHtml(payload.name)}</li>
        <li><strong>Email:</strong> ${escapeHtml(payload.email || "")}</li>
        <li><strong>Organization:</strong> ${escapeHtml(
          payload.organization || ""
        )}</li>
        <li><strong>Phone:</strong> ${escapeHtml(payload.phone || "")}</li>
        <li><strong>Preferred Date:</strong> ${escapeHtml(preferred)}</li>
        <li><strong>Message:</strong> ${escapeHtml(payload.message || "")}</li>
        <li><strong>IP:</strong> ${escapeHtml(payload.ip || "")}</li>
        <li><strong>User Agent:</strong> ${escapeHtml(
          payload.userAgent || ""
        )}</li>
      </ul>
    `;
  } else if (createdOrPayload && createdOrPayload.insertId) {
    subject = "New Demo Request (ID: " + createdOrPayload.insertId + ")";
    bodyHtml = `<p>A new demo request was saved (ID: ${createdOrPayload.insertId}).</p>`;
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: companyEmail,
    subject,
    html: bodyHtml,
  };

  console.info("[Email] Prepared mail", {
    from: mailOptions.from,
    to: mailOptions.to,
    subject: mailOptions.subject,
    htmlLength: mailOptions.html ? mailOptions.html.length : 0,
  });

  try {
    const info = await transporter.sendMail(mailOptions);

    if (process.env.LOG_SMTP === "true") {
      console.info("[Email] sendMail response", {
        messageId: info.messageId,
        response: info.response,
      });
    } else {
      console.info("[Email] Mail sent (messageId)", {
        messageId: info.messageId,
      });
    }
    return info;
  } catch (err) {
    const enriched = new Error(
      `Failed to send notification email: ${
        err && err.message ? err.message : err
      }`
    );
    enriched.original = err;

    console.error("[Email] sendMail failed", {
      message: err && err.message,
      code: err && err.code,
      response: err && err.response,
      responseCode: err && err.responseCode,
      command: err && err.command,
    });

    if (process.env.NODE_ENV !== "production") {
      console.error(err);
    }

    throw enriched;
  }
};

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = { sendNotificationEmail, transporter };
