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

function buildPieChartSvg(summary = {}) {
  const late = Math.max(0, toNumber(summary.lateCount, 0));
  const onTime = Math.max(0, toNumber(summary.onTimeCount, 0));
  const absent = Math.max(0, toNumber(summary.absentCount, 0));

  const total = Math.max(late + onTime + absent, 1);

  const latePct = (late / total) * 100;
  const onTimePct = (onTime / total) * 100;
  const absentPct = (absent / total) * 100;

  const radius = 46;
  const circumference = 2 * Math.PI * radius;

  const lateLen = (late / total) * circumference;
  const onTimeLen = (onTime / total) * circumference;
  const absentLen = Math.max(circumference - lateLen - onTimeLen, 0);

  const onTimeOffset = circumference - lateLen;
  const absentOffset = circumference - lateLen - onTimeLen;

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="620" height="240" viewBox="0 0 620 240" role="img" aria-label="Attendance summary chart">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#0f172a" flood-opacity="0.12" />
      </filter>
      <linearGradient id="lateGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ef4444"/>
        <stop offset="100%" stop-color="#b91c1c"/>
      </linearGradient>
      <linearGradient id="timeGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#22c55e"/>
        <stop offset="100%" stop-color="#15803d"/>
      </linearGradient>
      <linearGradient id="absentGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f59e0b"/>
        <stop offset="100%" stop-color="#d97706"/>
      </linearGradient>
    </defs>

    <rect x="0" y="0" width="620" height="240" rx="22" fill="#ffffff"/>

    <g filter="url(#shadow)">
      <circle cx="118" cy="120" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="22"/>
      <circle cx="118" cy="120" r="${radius}" fill="none" stroke="url(#lateGrad)" stroke-width="22"
        stroke-dasharray="${lateLen} ${circumference - lateLen}" stroke-linecap="round"
        transform="rotate(-90 118 120)"/>
      <circle cx="118" cy="120" r="${radius}" fill="none" stroke="url(#timeGrad)" stroke-width="22"
        stroke-dasharray="${onTimeLen} ${circumference - onTimeLen}" stroke-dashoffset="${onTimeOffset}"
        stroke-linecap="round" transform="rotate(-90 118 120)"/>
      <circle cx="118" cy="120" r="${radius}" fill="none" stroke="url(#absentGrad)" stroke-width="22"
        stroke-dasharray="${absentLen} ${circumference - absentLen}" stroke-dashoffset="${absentOffset}"
        stroke-linecap="round" transform="rotate(-90 118 120)"/>
      <circle cx="118" cy="120" r="34" fill="#fff"/>
    </g>

    <text x="118" y="114" text-anchor="middle" font-size="20" font-weight="700" fill="#0f172a">${total}</text>
    <text x="118" y="134" text-anchor="middle" font-size="11" fill="#64748b">records</text>

    <text x="250" y="46" font-size="20" font-weight="700" fill="#0f172a">Attendance snapshot</text>
    <text x="250" y="72" font-size="12" fill="#64748b">Late / On time / Absent</text>

    <g transform="translate(250, 96)">
      <rect width="320" height="28" rx="10" fill="#f8fafc"/>
      <rect x="0" y="0" width="${Math.max(0, Math.round((320 * latePct) / 100))}" height="28" rx="10" fill="#ef4444"/>
      <rect x="${Math.max(0, Math.round((320 * latePct) / 100))}" y="0" width="${Math.max(0, Math.round((320 * onTimePct) / 100))}" height="28" fill="#22c55e"/>
      <rect x="${Math.max(0, Math.round((320 * (latePct + onTimePct)) / 100))}" y="0" width="${Math.max(0, 320 - Math.round((320 * (latePct + onTimePct)) / 100))}" height="28" rx="10" fill="#f59e0b"/>
    </g>

    <g transform="translate(250, 150)">
      <circle cx="8" cy="8" r="6" fill="#ef4444"/>
      <text x="24" y="12" font-size="12" fill="#334155">Late: ${late} (${latePct.toFixed(0)}%)</text>

      <circle cx="146" cy="8" r="6" fill="#22c55e"/>
      <text x="162" y="12" font-size="12" fill="#334155">On time: ${onTime} (${onTimePct.toFixed(0)}%)</text>

      <circle cx="8" cy="38" r="6" fill="#f59e0b"/>
      <text x="24" y="42" font-size="12" fill="#334155">Absent: ${absent} (${absentPct.toFixed(0)}%)</text>
    </g>
  </svg>`;
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
  const limit = toNumber(summary.streakLimit ?? config?.late_streak_days, 0);
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

  const chartSvg = buildPieChartSvg(summary);
  const chartDataUri = `data:image/svg+xml;base64,${Buffer.from(chartSvg).toString("base64")}`;

  const title =
    recipientType === "employee"
      ? "Late login streak alert"
      : "Attendance escalation alert";

  const intro =
    recipientType === "employee"
      ? `Your late-login streak has reached <strong>${escapeHtml(streak)}</strong> day(s).`
      : `An employee late-login streak has reached <strong>${escapeHtml(streak)}</strong> day(s).`;

  const employeeBlock =
    recipientType === "employee"
      ? ""
      : `
        <div style="margin-top:18px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
          <div style="font-size:13px;color:#64748b;margin-bottom:6px;">Employee</div>
          <div style="font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(employeeName || "Employee")}</div>
        </div>
      `;

  const lateDatesHtml = lateDates.length
    ? `<ul style="margin:10px 0 0 18px;padding:0;color:#334155;">${lateDates
        .slice(0, 7)
        .map((d) => `<li style="margin:0 0 4px 0;">${escapeHtml(d)}</li>`)
        .join("")}</ul>`
    : `<div style="color:#64748b;font-size:13px;">No late dates were passed in the payload.</div>`;

  return `<!doctype html>
  <html>
    <head><meta charset="utf-8" /></head>
    <body style="font-family:Arial,Helvetica,sans-serif;background:#f6f7fb;margin:0;padding:24px;color:#1f2937;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:760px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:22px 24px;background:linear-gradient(135deg,#0f172a,#1d4ed8);color:#fff;">
            <div style="font-size:13px;opacity:.9;letter-spacing:.02em;">${escapeHtml(platformName)}</div>
            <div style="font-size:24px;font-weight:800;margin-top:6px;">${escapeHtml(title)}</div>
            <div style="font-size:13px;opacity:.9;margin-top:6px;">${escapeHtml(orgName || "Organization")}</div>
          </td>
        </tr>

        <tr>
          <td style="padding:24px;">
            <p style="margin:0 0 12px 0;font-size:15px;">Hi <strong>${escapeHtml(employeeName || "Team member")}</strong>,</p>
            <p style="margin:0 0 18px 0;line-height:1.7;font-size:14px;color:#334155;">${intro}</p>

            ${employeeBlock}

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">
              <tr>
                <td style="padding-right:10px;width:25%;">
                  <div style="border:1px solid #e5e7eb;border-radius:16px;padding:14px 12px;background:#f8fafc;">
                    <div style="font-size:12px;color:#64748b;">Streak limit</div>
                    <div style="font-size:20px;font-weight:800;color:#0f172a;">${escapeHtml(limit || "-")}</div>
                  </div>
                </td>
                <td style="padding-right:10px;width:25%;">
                  <div style="border:1px solid #e5e7eb;border-radius:16px;padding:14px 12px;background:#f8fafc;">
                    <div style="font-size:12px;color:#64748b;">Current streak</div>
                    <div style="font-size:20px;font-weight:800;color:#0f172a;">${escapeHtml(streak || "-")}</div>
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
                    <div style="font-size:20px;font-weight:800;color:#0f172a;">${escapeHtml(bufferMinutes)} min</div>
                  </div>
                </td>
              </tr>
            </table>

            <div style="margin-top:18px;border:1px solid #e5e7eb;border-radius:18px;padding:18px;background:#ffffff;">
              <img src="${chartDataUri}" alt="Attendance summary chart" style="display:block;width:100%;max-width:560px;height:auto;margin:0 auto;" />
            </div>

            <div style="margin-top:18px;border:1px solid #e5e7eb;border-radius:18px;padding:18px;background:#f8fafc;">
              <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:8px;">Recent late dates</div>
              ${lateDatesHtml}
            </div>

            <div style="margin-top:18px;font-size:13px;line-height:1.7;color:#475569;">
              Punch-out start: <strong>${escapeHtml(punchOutStart)}</strong><br/>
              Escalation mode: <strong>${escapeHtml(escalationMode)}</strong><br/>
              Action roles: <strong>${escapeHtml(Array.isArray(actionRoles) ? actionRoles.join(", ") : "")}</strong>
            </div>

            <p style="margin-top:18px;font-size:13px;color:#64748b;line-height:1.7;">
              This is an automated alert from ${escapeHtml(platformName)}. Please review the attendance dashboard for full details.
            </p>
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
