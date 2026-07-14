const { sendWithRetries } = require("./brevoMailer");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildLateLoginHtml({
  recipientType,
  platformName,
  orgName,
  employeeName,
  summary,
  config,
}) {
  const streak = toNumber(summary.currentStreak, 0);
  const limit = toNumber(summary.streakLimit ?? config?.late_streak_days, 3);
  const lateDates = Array.isArray(summary.lateDates) ? summary.lateDates : [];
  const punchInStart =
    summary.punchInStart || config?.punch_in_start || "--:--";
  const punchOutStart =
    summary.punchOutStart || config?.punch_out_start || "--:--";
  const bufferMinutes = summary.bufferMinutes ?? config?.buffer_minutes ?? 0;
  const escalationMode = config?.escalation_mode || "mail_notify";
  const actionRoles = Array.isArray(config?.action_roles)
    ? config.action_roles
    : [];

  const late = toNumber(summary.lateCount, 0);
  const onTime = toNumber(summary.onTimeCount, 0);
  const absent = toNumber(summary.absentCount, 0);

  const title =
    recipientType === "employee"
      ? "Late login streak alert"
      : "Attendance escalation alert";
  const headerOrgName =
    String(orgName || "")
      .replace(/\s*\d+$/, "")
      .trim() || "Organization";

  return `<!doctype html>
  <html>
    <head><meta charset="utf-8" /></head>
    <body style="font-family:Arial,Helvetica,sans-serif;background:#f6f7fb;margin:0;padding:24px;color:#1f2937;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:760px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:22px 24px;background:linear-gradient(135deg,#0f172a,#1d4ed8);color:#fff;">
            <div style="font-size:24px;font-weight:800;margin-top:6px;">${escapeHtml(title)}</div>
            <div style="font-size:15px;opacity:0.95;margin-top:4px;">${escapeHtml(headerOrgName)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <p style="margin:0 0 12px 0;font-size:15px;">Hi <strong>${escapeHtml(employeeName)}</strong>,</p>
            <p style="margin:0 0 18px 0;line-height:1.7;font-size:14px;color:#334155;">
              Your late-login streak has reached <strong>${streak}</strong> day(s).
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">
              <tr>
                <td style="padding-right:10px;width:25%;">
                  <div style="border:1px solid #e5e7eb;border-radius:16px;padding:14px 12px;background:#f8fafc;">
                    <div style="font-size:12px;color:#64748b;">Streak limit</div>
                    <div style="font-size:20px;font-weight:800;color:#0f172a;">${limit}</div>
                  </div>
                </td>
                <td style="padding-right:10px;width:25%;">
                  <div style="border:1px solid #e5e7eb;border-radius:16px;padding:14px 12px;background:#f8fafc;">
                    <div style="font-size:12px;color:#64748b;">Current streak</div>
                    <div style="font-size:20px;font-weight:800;color:#0f172a;">${streak}</div>
                  </div>
                </td>
                <td style="padding-right:10px;width:25%;">
                  <div style="border:1px solid #e5e7eb;border-radius:16px;padding:14px 12px;background:#f8fafc;">
                    <div style="font-size:12px;color:#64748b;">Punch-in start</div>
                    <div style="font-size:20px;font-weight:800;color:#0f172a;">${escapeHtml(punchInStart)}</div>
                  </div>
                </td>
                <td style="width:25%;">
                  <div style="border:1px solid #e5e7eb;border-radius:16px;padding:14px 12px;background:#f8fafc;">
                    <div style="font-size:12px;color:#64748b;">Buffer</div>
                    <div style="font-size:20px;font-weight:800;color:#0f172a;">${bufferMinutes} min</div>
                  </div>
                </td>
              </tr>
            </table>

            <!-- Text-based Attendance Summary -->
            <div style="margin-top:18px;border:1px solid #e5e7eb;border-radius:18px;padding:20px;background:#ffffff;">
              <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:12px;">Attendance Summary</div>
              <div style="display:flex;gap:12px;flex-wrap:wrap;">
                <div style="flex:1;min-width:140px;background:#fef2f2;padding:14px;border-radius:12px;">
                  <div style="color:#ef4444;font-size:13px;">Late</div>
                  <div style="font-size:26px;font-weight:800;color:#b91c1c;">${late}</div>
                </div>
                <div style="flex:1;min-width:140px;background:#f0fdf4;padding:14px;border-radius:12px;">
                  <div style="color:#22c55e;font-size:13px;">On Time</div>
                  <div style="font-size:26px;font-weight:800;color:#15803d;">${onTime}</div>
                </div>
                <div style="flex:1;min-width:140px;background:#fffbeb;padding:14px;border-radius:12px;">
                  <div style="color:#f59e0b;font-size:13px;">Absent</div>
                  <div style="font-size:26px;font-weight:800;color:#b45309;">${absent}</div>
                </div>
              </div>
            </div>

            <div style="margin-top:18px;border:1px solid #e5e7eb;border-radius:18px;padding:18px;background:#f8fafc;">
              <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:8px;">Recent late dates</div>
              <ul style="margin:10px 0 0 18px;padding:0;color:#334155;">
                ${lateDates
                  .slice(0, 7)
                  .map((d) => `<li>${escapeHtml(d)}</li>`)
                  .join("")}
              </ul>
            </div>

            <div style="margin-top:18px;font-size:13px;line-height:1.7;color:#475569;">
              Punch-out start: <strong>${escapeHtml(punchOutStart)}</strong><br/>
              Escalation mode: <strong>${escapeHtml(escalationMode)}</strong>
            </div>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

function buildLateLoginText({
  recipientType,
  platformName,
  orgName,
  employeeName,
  summary,
  config,
}) {
  const streak = toNumber(summary.currentStreak, 0);
  const limit = toNumber(summary.streakLimit ?? config?.late_streak_days, 0);
  const lateDates = Array.isArray(summary.lateDates) ? summary.lateDates : [];

  return `${platformName} - ${recipientType === "employee" ? "Late login alert" : "Attendance escalation alert"}

Organization: ${orgName || "Organization"}
Employee: ${employeeName || "Employee"}
Current streak: ${streak}
Streak limit: ${limit}

Late dates:
${lateDates.length ? lateDates.join(", ") : "N/A"}
`;
}

async function sendLateLoginEmployeeAlert({
  employeeEmail,
  employeeName,
  orgName,
  summary = {},
  config = {},
}) {
  if (!employeeEmail) return false;

  const platformName = process.env.PLATFORM_NAME || "PULSEWORK";
  const senderName = process.env.SMTP_SENDER_NAME || platformName;

  try {
    await sendWithRetries({
      sender: {
        email: process.env.BREVO_SENDER_EMAIL,
        name: senderName,
      },
      to: [{ email: employeeEmail, name: employeeName || employeeEmail }],
      subject: `${platformName} — Late login alert`,
      htmlContent: buildLateLoginHtml({
        recipientType: "employee",
        platformName,
        orgName,
        employeeName,
        summary,
        config,
      }),
      textContent: buildLateLoginText({
        recipientType: "employee",
        platformName,
        orgName,
        employeeName,
        summary,
        config,
      }),
    });

    return true;
  } catch (err) {
    console.error("Employee mail send failed:", err?.response?.body || err);
    return false;
  }
}

async function sendLateLoginStakeholderAlert({
  recipients = [],
  orgName,
  employeeName,
  summary = {},
  config = {},
}) {
  const platformName = process.env.PLATFORM_NAME || "PULSEWORK";
  const senderName = process.env.SMTP_SENDER_NAME || platformName;

  const uniqueRecipients = (recipients || [])
    .map((r) => ({
      email: String(r?.email || "").trim(),
      name: String(r?.name || r?.email || "Stakeholder").trim(),
      role: String(r?.role || "").trim(),
    }))
    .filter((r) => r.email);

  if (!uniqueRecipients.length) return false;

  try {
    await sendWithRetries({
      sender: {
        email: process.env.BREVO_SENDER_EMAIL,
        name: senderName,
      },
      to: uniqueRecipients.map((r) => ({
        email: r.email,
        name: r.name,
      })),
      subject: `${platformName} — Attendance escalation alert`,
      htmlContent: buildLateLoginHtml({
        recipientType: "stakeholder",
        platformName,
        orgName,
        employeeName,
        summary,
        config,
      }),
      textContent: buildLateLoginText({
        recipientType: "stakeholder",
        platformName,
        orgName,
        employeeName,
        summary,
        config,
      }),
    });

    return true;
  } catch (err) {
    console.error("Stakeholder mail send failed:", err?.response?.body || err);
    return false;
  }
}

module.exports = {
  sendLateLoginEmployeeAlert,
  sendLateLoginStakeholderAlert,
  sendLateLoginStreakEmails: async (args) => {
    const employeeSent = await sendLateLoginEmployeeAlert(args);
    const stakeholderSent = await sendLateLoginStakeholderAlert(args);
    return { employeeSent, stakeholderSent };
  },
};
