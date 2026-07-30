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

function uniqByEmail(items = []) {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const email = String(item?.email || "")
      .trim()
      .toLowerCase();

    if (!email || seen.has(email)) continue;
    seen.add(email);
    output.push({
      email: String(item.email).trim(),
      name: String(item.name || item.email || "Recipient").trim(),
      role: item.role ? String(item.role).trim() : undefined,
    });
  }

  return output;
}

async function sendHtmlMail({
  orgName,
  to,
  subject,
  htmlContent,
  textContent,
  cc,
}) {
  const headerOrgName = escapeHtml(
    String(orgName || "")
      .replace(/\s*\d+$/, "")
      .trim() || "Organization",
  );
  const platformName = headerOrgName || "PULSEWORK";
  const senderName = platformName;

  const payload = {
    sender: {
      email: process.env.BREVO_SENDER_EMAIL,
      name: senderName,
    },
    to,
    subject,
    htmlContent,
    textContent,
  };

  if (Array.isArray(cc) && cc.length > 0) {
    payload.cc = cc;
  }

  return sendWithRetries(payload);
}

function buildLateLoginHtml({
  title,
  orgName,
  employeeName,
  summary = {},
  config = {},
  recipientType = "employee",
  orgSummary = null,
}) {
  const streak = Number(summary.currentStreak || 0);
  const limit = Number(summary.streakLimit ?? config?.late_streak_days ?? 0);
  const lateRecords = Array.isArray(summary.lateDates) ? summary.lateDates : [];
  const punchInStart =
    summary.punchInStart || config?.punch_in_start || "--:--";
  const punchOutStart =
    summary.punchOutStart || config?.punch_out_start || "--:--";
  const bufferMinutes = summary.bufferMinutes ?? config?.buffer_minutes ?? 0;
  const escalationMode = config?.escalation_mode || "mail_notify";
  const periodLabel = summary.periodLabel || "Current period";

  const stats = summary.stats || {};
  const present = Number(stats.present_count ?? 0);
  const absent = Number(stats.absent_count ?? summary.absentCount ?? 0);
  const lateCount = Number(stats.late_count ?? lateRecords.length ?? 0);
  const onTime = Number(
    stats.on_time_count ??
      summary.onTimeCount ??
      Math.max(0, present - lateCount),
  );

  const headerOrgName = escapeHtml(
    String(orgName || "")
      .replace(/\s*\d+$/, "")
      .trim() || "Organization",
  );

  const isEmployee = recipientType === "employee";
  const resolvedTitle =
    title ||
    (isEmployee ? "Late login streak alert" : "Attendance escalation alert");

  const intro = isEmployee
    ? `Your late-login streak has reached <strong>${escapeHtml(String(streak))}</strong> day(s). Below is your attendance summary for <strong>${escapeHtml(periodLabel)}</strong>.`
    : `Employee <strong>${escapeHtml(employeeName || "Employee")}</strong> has reached a late-login streak of <strong>${escapeHtml(String(streak))}</strong> day(s). Summary period: <strong>${escapeHtml(periodLabel)}</strong>.`;

  const lateListHtml =
    lateRecords.length > 0
      ? lateRecords
          .slice(0, 10)
          .map((record) => {
            if (typeof record === "string") {
              return `<tr>
                <td style="padding:10px 12px;border-bottom:1px solid #fee2e2;">${escapeHtml(record)}</td>
                <td style="padding:10px 12px;border-bottom:1px solid #fee2e2;color:#64748b;">—</td>
                <td style="padding:10px 12px;border-bottom:1px solid #fee2e2;text-align:right;">
                  <span style="background:#fef2f2;color:#b91c1c;font-weight:700;padding:4px 10px;border-radius:999px;font-size:12px;">Late</span>
                </td>
              </tr>`;
            }
            const mins = Number(record.minutesLate || 0);
            return `<tr>
              <td style="padding:10px 12px;border-bottom:1px solid #fee2e2;font-weight:600;color:#0f172a;">${escapeHtml(record.date)}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #fee2e2;color:#475569;">${escapeHtml(record.time || "--:--")}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #fee2e2;text-align:right;">
                <span style="background:#fef2f2;color:#b91c1c;font-weight:700;padding:4px 10px;border-radius:999px;font-size:12px;">${mins} min late</span>
              </td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="3" style="padding:14px;color:#64748b;text-align:center;">No late records in this period.</td></tr>`;

  const total = Math.max(lateCount + onTime + absent, 1);
  const latePct = Math.round((lateCount / total) * 100);
  const onTimePct = Math.round((onTime / total) * 100);
  const absentPct = Math.max(0, 100 - latePct - onTimePct);

  let orgTableHtml = "";
  if (
    !isEmployee &&
    orgSummary &&
    Array.isArray(orgSummary.employees) &&
    orgSummary.employees.length
  ) {
    const rows = orgSummary.employees
      .slice(0, 25)
      .map((emp) => {
        const lateBadge =
          emp.lateDays > 0
            ? `<span style="background:#fef2f2;color:#b91c1c;font-weight:700;padding:3px 8px;border-radius:999px;font-size:11px;">${emp.lateDays} late</span>`
            : `<span style="color:#16a34a;font-size:12px;">On track</span>`;
        return `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;">${escapeHtml(emp.employeeName)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${emp.presentDays}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${lateBadge}</td>
        </tr>`;
      })
      .join("");

    orgTableHtml = `
      <div style="margin-top:22px;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
        <div style="padding:14px 18px;background:#0f172a;color:#fff;font-size:14px;font-weight:700;">
          Team attendance · ${escapeHtml(orgSummary.period_label || periodLabel)}
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#fff;">
          <tr style="background:#f8fafc;">
            <th style="text-align:left;padding:10px 12px;font-size:12px;color:#64748b;">Employee</th>
            <th style="text-align:center;padding:10px 12px;font-size:12px;color:#64748b;">Present</th>
            <th style="text-align:center;padding:10px 12px;font-size:12px;color:#64748b;">Late days</th>
          </tr>
          ${rows}
        </table>
      </div>`;
  }

  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 10px 30px rgba(15,23,42,0.06);">
    <tr>
      <td style="padding:26px 28px;background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 100%);color:#fff;">
        <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.8;font-weight:600;">
          ${escapeHtml(headerOrgName || "PULSEWORK")}
        </div>
        <div style="font-size:24px;font-weight:800;margin-top:8px;line-height:1.25;">${escapeHtml(resolvedTitle)}</div>
        <div style="font-size:14px;opacity:0.92;margin-top:6px;">${headerOrgName}</div>
      </td>
    </tr>

    <tr>
      <td style="padding:28px;">
        <p style="margin:0 0 8px 0;font-size:15px;">Hi <strong>${escapeHtml(isEmployee ? employeeName || "there" : "Team")}</strong>,</p>
        <p style="margin:0 0 20px 0;line-height:1.7;font-size:14px;color:#334155;">${intro}</p>

        ${
          isEmployee
            ? ""
            : `
        <div style="margin-top:4px;margin-bottom:18px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
          <div style="font-size:13px;color:#64748b;margin-bottom:6px;">Employee</div>
          <div style="font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(employeeName || "Employee")}</div>
        </div>`
        }

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
          <tr>
            <td style="width:25%;padding:4px;">
              <div style="border:1px solid #e2e8f0;border-radius:14px;padding:14px 10px;background:#f8fafc;text-align:center;">
                <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Streak limit</div>
                <div style="font-size:22px;font-weight:800;color:#0f172a;margin-top:4px;">${limit || "—"}</div>
              </div>
            </td>
            <td style="width:25%;padding:4px;">
              <div style="border:1px solid #fecaca;border-radius:14px;padding:14px 10px;background:#fef2f2;text-align:center;">
                <div style="font-size:11px;color:#b91c1c;text-transform:uppercase;letter-spacing:0.04em;">Current streak</div>
                <div style="font-size:22px;font-weight:800;color:#b91c1c;margin-top:4px;">${streak}</div>
              </div>
            </td>
            <td style="width:25%;padding:4px;">
              <div style="border:1px solid #e2e8f0;border-radius:14px;padding:14px 10px;background:#f8fafc;text-align:center;">
                <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Punch-in</div>
                <div style="font-size:18px;font-weight:800;color:#0f172a;margin-top:4px;">${escapeHtml(punchInStart)}</div>
              </div>
            </td>
            <td style="width:25%;padding:4px;">
              <div style="border:1px solid #e2e8f0;border-radius:14px;padding:14px 10px;background:#f8fafc;text-align:center;">
                <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Buffer</div>
                <div style="font-size:18px;font-weight:800;color:#0f172a;margin-top:4px;">${bufferMinutes}m</div>
              </div>
            </td>
          </tr>
        </table>

        <div style="margin-top:20px;border:1px solid #e2e8f0;border-radius:18px;padding:18px;background:#fff;">
          <div style="margin-bottom:14px;">
            <div style="font-size:15px;font-weight:700;color:#0f172a;display:inline-block;">Attendance summary</div>
            <div style="font-size:12px;color:#64748b;background:#f1f5f9;padding:4px 10px;border-radius:999px;display:inline-block;margin-left:8px;">${escapeHtml(periodLabel)}</div>
          </div>

          <div style="background:#f1f5f9;border-radius:10px;overflow:hidden;height:12px;margin-bottom:14px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="height:12px;border-collapse:collapse;">
              <tr>
                <td style="width:${Math.max(0, latePct)}%;background:#ef4444;height:12px;font-size:0;line-height:0;">&nbsp;</td>
                <td style="width:${Math.max(0, onTimePct)}%;background:#22c55e;height:12px;font-size:0;line-height:0;">&nbsp;</td>
                <td style="width:${Math.max(0, absentPct)}%;background:#f59e0b;height:12px;font-size:0;line-height:0;">&nbsp;</td>
              </tr>
            </table>
          </div>

          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                <span style="display:inline-block;width:10px;height:10px;background:#22c55e;border-radius:50%;margin-right:8px;"></span>
                Present / On time
              </td>
              <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700;color:#15803d;">${present} <span style="color:#94a3b8;font-weight:500;">(${onTime} on time)</span></td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                <span style="display:inline-block;width:10px;height:10px;background:#ef4444;border-radius:50%;margin-right:8px;"></span>
                Late login days
              </td>
              <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700;color:#b91c1c;">${lateCount}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;">
                <span style="display:inline-block;width:10px;height:10px;background:#f59e0b;border-radius:50%;margin-right:8px;"></span>
                Absent (est.)
              </td>
              <td style="padding:10px 0;text-align:right;font-weight:700;color:#b45309;">${absent}</td>
            </tr>
          </table>
        </div>

        <div style="margin-top:20px;border:1px solid #fecaca;border-radius:18px;overflow:hidden;background:#fff;">
          <div style="padding:14px 18px;background:#fef2f2;border-bottom:1px solid #fecaca;">
            <div style="font-size:14px;font-weight:700;color:#991b1b;">Late login records</div>
            <div style="font-size:12px;color:#b91c1c;margin-top:2px;">Dates highlighted with delay duration</div>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr style="background:#fff7f7;">
              <th style="text-align:left;padding:10px 12px;font-size:11px;color:#9f1239;text-transform:uppercase;">Date</th>
              <th style="text-align:left;padding:10px 12px;font-size:11px;color:#9f1239;text-transform:uppercase;">Punch-in</th>
              <th style="text-align:right;padding:10px 12px;font-size:11px;color:#9f1239;text-transform:uppercase;">Delay</th>
            </tr>
            ${lateListHtml}
          </table>
        </div>

        ${orgTableHtml}

        <div style="margin-top:20px;padding:14px 16px;background:#f8fafc;border-radius:14px;border:1px solid #e2e8f0;font-size:13px;line-height:1.7;color:#475569;">
          Punch-out start: <strong>${escapeHtml(punchOutStart)}</strong><br/>
          Escalation mode: <strong>${escapeHtml(escalationMode)}</strong>
        </div>

        <p style="margin-top:20px;font-size:12px;color:#94a3b8;line-height:1.6;">
          This is an automated alert from ${escapeHtml(headerOrgName || "PULSEWORK")}. Review the attendance dashboard for full history.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildLateLoginText({
  recipientType,
  orgName,
  employeeName,
  summary = {},
  config = {},
}) {
  const headerOrgName = escapeHtml(
    String(orgName || "")
      .replace(/\s*\d+$/, "")
      .trim() || "Organization",
  );
  const platformName = headerOrgName || "PULSEWORK";
  const streak = toNumber(summary.currentStreak, 0);
  const limit = toNumber(summary.streakLimit ?? config?.late_streak_days, 0);
  const lateRecords = Array.isArray(summary.lateDates) ? summary.lateDates : [];
  const punchInStart =
    summary.punchInStart || config?.punch_in_start || "--:--";
  const punchOutStart =
    summary.punchOutStart || config?.punch_out_start || "--:--";
  const bufferMinutes = summary.bufferMinutes ?? config?.buffer_minutes ?? 0;
  const escalationMode = config?.escalation_mode || "mail_notify";
  const periodLabel = summary.periodLabel || "Current period";

  const lateLines = lateRecords
    .map((r) =>
      typeof r === "string"
        ? r
        : `${r.date} at ${r.time || "?"} (${r.minutesLate || 0} min late)`,
    )
    .join("\n");

  return `${platformName} - ${
    recipientType === "employee"
      ? "Late login alert"
      : "Attendance escalation alert"
  }

Organization: ${orgName || "Organization"}
Employee: ${employeeName || "Employee"}
Period: ${periodLabel}
Current streak: ${streak}
Streak limit: ${limit}
Punch-in start: ${punchInStart}
Punch-out start: ${punchOutStart}
Buffer minutes: ${bufferMinutes}
Escalation mode: ${escalationMode}

Late logins:
${lateLines || "N/A"}
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

  const headerOrgName = escapeHtml(
    String(orgName || "")
      .replace(/\s*\d+$/, "")
      .trim() || "Organization",
  );

  const platformName = headerOrgName || "PULSEWORK";

  try {
    await sendHtmlMail({
      orgName,
      to: [{ email: employeeEmail, name: employeeName || employeeEmail }],
      subject: `${platformName} — Late login alert (${summary.periodLabel || "period"})`,
      htmlContent: buildLateLoginHtml({
        title: "Late login streak alert",
        recipientType: "employee",
        orgName,
        employeeName,
        summary,
        config,
      }),
      textContent: buildLateLoginText({
        recipientType: "employee",
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
  orgSummary = null,
}) {
  const uniqueRecipients = uniqByEmail(
    (recipients || []).map((r) => ({
      email: r?.email,
      name: r?.name || r?.email,
      role: r?.role,
    })),
  );

  if (!uniqueRecipients.length) return false;

  const headerOrgName = escapeHtml(
    String(orgName || "")
      .replace(/\s*\d+$/, "")
      .trim() || "Organization",
  );

  const platformName = headerOrgName || "PULSEWORK";

  try {
    await sendHtmlMail({
      orgName,
      to: uniqueRecipients.map((r) => ({
        email: r.email,
        name: r.name,
      })),
      subject: `${platformName} — Attendance escalation · ${employeeName || "Employee"}`,
      htmlContent: buildLateLoginHtml({
        title: "Attendance escalation alert",
        recipientType: "stakeholder",
        orgName,
        employeeName,
        summary,
        config,
        orgSummary,
      }),
      textContent: buildLateLoginText({
        recipientType: "stakeholder",
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
  // exported for tests / reuse
  buildLateLoginHtml,
  buildLateLoginText,
};
