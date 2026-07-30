const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const attendanceQueries = require("../constants/attendanceQueries");
const { sendWithRetries } = require("../utils/brevoMailer");
const fs = require("fs");
const path = require("path");

const ROLE_PRIORITY = ["admin", "hr", "manager", "supervisor"];

const toRadians = (value) => (value * Math.PI) / 180;

const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth radius in meters

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function safeJsonParse(value, fallback = null) {
  if (value == null) return fallback;
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeRole(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[_\s]+/g, " ")
    .trim();
}

function normalizeActionRoles(value) {
  const parsed = safeJsonParse(value, value);
  let roles = [];

  if (Array.isArray(parsed)) {
    roles = parsed;
  } else if (parsed && typeof parsed === "object") {
    roles = Object.entries(parsed)
      .filter(([, enabled]) => {
        const normalized = String(enabled).toLowerCase().trim();
        return enabled === true || enabled === 1 || normalized === "true";
      })
      .map(([role]) => role);
  } else if (typeof parsed === "string") {
    roles = parsed.split(",");
  }

  return Array.from(new Set(roles.map(normalizeRole).filter(Boolean)));
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
    output.push(item);
  }

  return output;
}

function formatDateKey(dateValue) {
  if (!dateValue) return null;

  if (typeof dateValue === "string") {
    const trimmed = dateValue.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
  }

  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return String(dateValue).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function consecutiveLateStreak(lateDates = []) {
  const normalized = Array.from(
    new Set((lateDates || []).map((d) => formatDateKey(d)).filter(Boolean)),
  )
    .sort()
    .reverse();

  if (!normalized.length) return 0;

  let streak = 1;
  let current = normalized[0];

  for (let i = 1; i < normalized.length; i += 1) {
    const prev = new Date(`${current}T00:00:00.000Z`);
    prev.setUTCDate(prev.getUTCDate() - 1);
    const prevKey = prev.toISOString().slice(0, 10);

    if (normalized[i] === prevKey) {
      streak += 1;
      current = prevKey;
    } else {
      break;
    }
  }

  return streak;
}

/** Period window from login_hours_config.streak_period (monthly | 15days) */
function getPeriodWindow(streakPeriod) {
  const period = String(streakPeriod || "monthly")
    .toLowerCase()
    .replace(/[_\s-]/g, "");
  const now = new Date();
  let startDate;
  let label;

  if (period === "15days" || period === "15day" || period === "fifteendays") {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 14); // inclusive 15 calendar days
    label = "Last 15 days";
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    label = "Current month";
  }

  const y = startDate.getFullYear();
  const m = String(startDate.getMonth() + 1).padStart(2, "0");
  const d = String(startDate.getDate()).padStart(2, "0");

  return {
    startDateKey: `${y}-${m}-${d}`,
    endDateKey: formatDateKey(now),
    label,
    periodKey:
      period === "15days" || period === "15day" || period === "fifteendays"
        ? "15days"
        : "monthly",
  };
}

function minutesBetween(punchTime, thresholdTime) {
  if (!punchTime || !thresholdTime) return 0;
  const diffMs =
    new Date(punchTime).getTime() - new Date(thresholdTime).getTime();
  return Math.max(0, Math.round(diffMs / 60000));
}

async function tableExists(tenantPool, tableName) {
  const [rows] = await tenantPool.execute(
    `SELECT 1
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
     LIMIT 1`,
    [tableName],
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function columnExists(tenantPool, tableName, columnName) {
  const [rows] = await tenantPool.execute(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName],
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function fetchFirstAvailableRow(tenantPool, sqlList, params = []) {
  let lastErr = null;

  for (const sql of sqlList) {
    try {
      const [rows] = await tenantPool.execute(sql, params);
      if (Array.isArray(rows) && rows.length > 0) return rows[0];
    } catch (err) {
      lastErr = err;
    }
  }

  if (lastErr) throw lastErr;
  return null;
}

const masterDb = require("../config");

async function getOrganizationName(orgId) {
  try {
    const [rows] = await masterDb.query(
      `SELECT name FROM organizations WHERE id = ? LIMIT 1`,
      [orgId],
    );

    return rows?.[0]?.name || "Organization";
  } catch (error) {
    console.warn(
      `[getOrganizationName] Failed to fetch organization name for org ${orgId}:`,
      error.message,
    );
    return "Organization";
  }
}

async function sendHtmlMail({
  orgName,
  to,
  subject,
  htmlContent,
  textContent,
  cc,
}) {
  const senderName = orgName || "PULSEWORK";

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

  const intro = isEmployee
    ? `Your late-login streak has reached <strong>${escapeHtml(String(streak))}</strong> day(s). Below is your attendance summary for <strong>${escapeHtml(periodLabel)}</strong>.`
    : `Employee <strong>${escapeHtml(employeeName || "Employee")}</strong> has reached a late-login streak of <strong>${escapeHtml(String(streak))}</strong> day(s). Summary period: <strong>${escapeHtml(periodLabel)}</strong>.`;

  const total = Math.max(lateCount + onTime + absent, 1);
  const latePct = Math.round((lateCount / total) * 100);
  const onTimePct = Math.round((onTime / total) * 100);
  const absentPct = Math.max(0, 100 - latePct - onTimePct);

  const attendanceHtml = `
<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  style="border-collapse:collapse;">

  <tr>

    <!-- LEFT SIDE : KPI CARDS -->

    <td width="220" valign="top">

      <table
        width="100%"
        cellpadding="6"
        cellspacing="0"
        style="border-collapse:collapse;">

        <tr>

          <td
            style="
            border:1px solid #fecaca;
            border-radius:12px;
            background:#fef2f2;
            text-align:center;
            padding:14px;
            ">

            <div
              style="
              font-size:13px;
              color:#991b1b;
              font-weight:bold;
              ">
              Late
            </div>

            <div
              style="
              font-size:28px;
              font-weight:700;
              color:#dc2626;
              margin-top:6px;
              ">
              ${lateCount}
            </div>

            <div
              style="
              font-size:13px;
              color:#991b1b;
              ">
              ${latePct}%
            </div>

          </td>

        </tr>

        <tr>

          <td
            style="
            border:1px solid #bbf7d0;
            border-radius:12px;
            background:#f0fdf4;
            text-align:center;
            padding:14px;
            ">

            <div
              style="
              font-size:13px;
              color:#166534;
              font-weight:bold;
              ">
              On Time
            </div>

            <div
              style="
              font-size:28px;
              font-weight:700;
              color:#16a34a;
              margin-top:6px;
              ">
              ${onTime}
            </div>

            <div
              style="
              font-size:13px;
              color:#166534;
              ">
              ${onTimePct}%
            </div>

          </td>

        </tr>

        <tr>

          <td
            style="
            border:1px solid #fed7aa;
            border-radius:12px;
            background:#fff7ed;
            text-align:center;
            padding:14px;
            ">

            <div
              style="
              font-size:13px;
              color:#9a3412;
              font-weight:bold;
              ">
              Absent
            </div>

            <div
              style="
              font-size:28px;
              font-weight:700;
              color:#ea580c;
              margin-top:6px;
              ">
              ${absent}
            </div>

            <div
              style="
              font-size:13px;
              color:#9a3412;
              ">
              ${absentPct}%
            </div>

          </td>

        </tr>

      </table>

    </td>

    <!-- RIGHT SIDE -->

    <td
      valign="top"
      style="padding-left:20px;">

      <div
        style="
        font-size:20px;
        font-weight:bold;
        color:#0f172a;
        margin-bottom:6px;
        ">
        Attendance Snapshot
      </div>

      <div
        style="
        font-size:13px;
        color:#64748b;
        margin-bottom:18px;
        ">
        ${escapeHtml(periodLabel)}
      </div>

      <!-- PROGRESS BAR -->

      <table
        width="100%"
        cellpadding="0"
        cellspacing="0"
        style="
        border-collapse:collapse;
        border-radius:8px;
        overflow:hidden;
        ">

        <tr>

          <td
            width="${latePct}%"
            style="
            background:#ef4444;
            height:18px;
            font-size:0;
            ">
            &nbsp;
          </td>

          <td
            width="${onTimePct}%"
            style="
            background:#22c55e;
            height:18px;
            font-size:0;
            ">
            &nbsp;
          </td>

          <td
            width="${absentPct}%"
            style="
            background:#f59e0b;
            height:18px;
            font-size:0;
            ">
            &nbsp;
          </td>

        </tr>

      </table>

      <!-- LEGEND -->

      <table
        width="100%"
        cellpadding="6"
        cellspacing="0"
        style="
        margin-top:18px;
        border-collapse:collapse;
        ">

        <tr>

          <td>

            <span
              style="
              display:inline-block;
              width:10px;
              height:10px;
              background:#22c55e;
              border-radius:50%;
              margin-right:8px;
              ">
            </span>

            On Time

          </td>

          <td
            align="right">

            ${onTime} (${onTimePct}%)

          </td>

        </tr>

        <tr>

          <td>

            <span
              style="
              display:inline-block;
              width:10px;
              height:10px;
              background:#ef4444;
              border-radius:50%;
              margin-right:8px;
              ">
            </span>

            Late

          </td>

          <td
            align="right">

            ${lateCount} (${latePct}%)

          </td>

        </tr>

        <tr>

          <td>

            <span
              style="
              display:inline-block;
              width:10px;
              height:10px;
              background:#f59e0b;
              border-radius:50%;
              margin-right:8px;
              ">
            </span>

            Absent

          </td>

          <td
            align="right">

            ${absent} (${absentPct}%)

          </td>

        </tr>

      </table>

    </td>

  </tr>

</table>
`;

  const chartInline = attendanceHtml;

  const employeeBlock = isEmployee
    ? ""
    : `
        <div style="margin-top:18px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
          <div style="font-size:13px;color:#64748b;margin-bottom:6px;">Employee</div>
          <div style="font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(employeeName || "Employee")}</div>
        </div>
      `;

  const lateListRows =
    lateRecords.length > 0
      ? lateRecords
          .slice(0, 10)
          .map((record) => {
            if (typeof record === "string") {
              return `<tr>
                <td style="padding:10px 12px;border-bottom:1px solid #fee2e2;font-weight:600;color:#0f172a;">${escapeHtml(record)}</td>
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
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
    </head>
    <body style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#1f2937;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 10px 30px rgba(15,23,42,0.06);">
        <tr>
          <td style="padding:26px 28px;background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 100%);color:#fff;">
            <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.8;font-weight:600;">
              ${escapeHtml(headerOrgName || "PULSEWORK")}
            </div>
            <div style="font-size:24px;font-weight:800;margin-top:8px;line-height:1.25;">${escapeHtml(title)}</div>
            <div style="font-size:14px;opacity:0.92;margin-top:6px;">${headerOrgName}</div>
          </td>
        </tr>

        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 8px 0;font-size:15px;">Hi <strong>${escapeHtml(isEmployee ? employeeName || "there" : "Team")}</strong>,</p>
            <p style="margin:0 0 20px 0;line-height:1.7;font-size:14px;color:#334155;">${intro}</p>

            ${employeeBlock}

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

            <div style="margin-top:18px;border:1px solid #e5e7eb;border-radius:18px;padding:18px;background:#ffffff;">
              ${chartInline}
            </div>

            <div style="margin-top:20px;border:1px solid #e2e8f0;border-radius:18px;padding:18px;background:#fff;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
                <div style="font-size:15px;font-weight:700;color:#0f172a;">Attendance summary</div>
                <div style="font-size:12px;color:#64748b;background:#f1f5f9;padding:4px 10px;border-radius:999px;">${escapeHtml(periodLabel)}</div>
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
                <div style="font-size:12px;color:#b91c1c;margin-top:2px;">Dates with delay duration</div>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr style="background:#fff7f7;">
                  <th style="text-align:left;padding:10px 12px;font-size:11px;color:#9f1239;text-transform:uppercase;">Date</th>
                  <th style="text-align:left;padding:10px 12px;font-size:11px;color:#9f1239;text-transform:uppercase;">Punch-in</th>
                  <th style="text-align:right;padding:10px 12px;font-size:11px;color:#9f1239;text-transform:uppercase;">Delay</th>
                </tr>
                ${lateListRows}
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

  const lateLines = lateRecords
    .map((r) =>
      typeof r === "string"
        ? r
        : `${r.date} at ${r.time || "?"} (${r.minutesLate || 0} min late)`,
    )
    .join("\n");

  return `${orgName || "PULSEWORK"} - ${
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
  summary,
  config,
}) {
  if (!employeeEmail) return false;

  const lateCount = Number(
    summary?.stats?.late_count ??
      (Array.isArray(summary?.lateDates) ? summary.lateDates.length : 0) ??
      summary?.lateCount ??
      0,
  );
  const onTimeCount = Number(
    summary?.onTimeCount ?? summary?.stats?.on_time_count ?? 0,
  );
  const absentCount = Number(
    summary?.absentCount ?? summary?.stats?.absent_count ?? 0,
  );

  await sendHtmlMail({
    orgName,
    to: [{ email: employeeEmail, name: employeeName || employeeEmail }],
    subject: `${orgName || "PULSEWORK"} — Late login alert (${summary?.periodLabel || "period"})`,
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
}

async function sendLateLoginStakeholderAlert({
  recipients = [],
  orgName,
  employeeName,
  summary,
  config,
  orgSummary = null,
}) {
  const uniqueRecipients = uniqByEmail(
    (recipients || []).map((r) => ({
      email: r.email,
      name: r.name || r.email,
    })),
  );

  if (!uniqueRecipients.length) return false;

  const lateCount = Number(
    summary?.stats?.late_count ??
      (Array.isArray(summary?.lateDates) ? summary.lateDates.length : 0) ??
      summary?.lateCount ??
      0,
  );
  const onTimeCount = Number(
    summary?.onTimeCount ?? summary?.stats?.on_time_count ?? 0,
  );
  const absentCount = Number(
    summary?.absentCount ?? summary?.stats?.absent_count ?? 0,
  );

  await sendHtmlMail({
    orgName,
    to: uniqueRecipients,
    subject: `${orgName || "PULSEWORK"} — Attendance escalation · ${employeeName || "Employee"}`,
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
}

const attendanceService = {
  getEmployeeAttendance: async (employeeId, orgId) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      const [rows] = await tenantPool.execute(
        attendanceQueries.GET_EMPLOYEE_ATTENDANCE,
        [employeeId],
      );
      return rows;
    } catch (error) {
      console.error("Error in getEmployeeAttendance:", error);
      throw error;
    }
  },

  hasColumn: async (orgId, tableName, columnName) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      return await columnExists(tenantPool, tableName, columnName);
    } catch (error) {
      console.error("Error in hasColumn:", error);
      throw error;
    }
  },

  validateEmployeeOfficeLocation: async (
    employeeId,
    latitude,
    longitude,
    orgId,
    device,
  ) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);

      const [rows] = await tenantPool.execute(
        attendanceQueries.GET_EMPLOYEE_ASSIGNED_OFFICES,
        [employeeId],
      );

      if (!rows || rows.length === 0) {
        return {
          allowed: true,
          message: "No office assigned - WFH allowed",
          office: null,
          distance: null,
          isWfh: true,
        };
      }

      if (device !== "Mobile" && device !== "mobile") {
        return {
          allowed: false,
          message:
            "Office assigned employees can only punch from Mobile device",
          office: null,
          distance: null,
          isWfh: false,
        };
      }

      if (
        latitude === undefined ||
        longitude === undefined ||
        Number.isNaN(Number(latitude)) ||
        Number.isNaN(Number(longitude))
      ) {
        return {
          allowed: false,
          message:
            "Valid latitude and longitude are required for office employees",
        };
      }

      let nearestOffice = null;
      let nearestDistance = null;

      for (const office of rows) {
        const distance = calculateDistanceMeters(
          Number(latitude),
          Number(longitude),
          Number(office.latitude),
          Number(office.longitude),
        );

        if (nearestDistance === null || distance < nearestDistance) {
          nearestDistance = distance;
          nearestOffice = office;
        }

        if (distance <= Number(office.radius)) {
          return {
            allowed: true,
            message: "Location validated successfully",
            office: {
              id: office.id,
              office_name: office.office_name,
              address: office.address,
              radius: office.radius,
            },
            distance: Math.round(distance),
            isWfh: false,
          };
        }
      }

      return {
        allowed: false,
        message: `You are outside office radius. Nearest assigned office is ${
          nearestOffice?.office_name || "Office"
        } and your current distance is ${
          nearestDistance ? Math.round(nearestDistance) : "N/A"
        } meters`,
        office: nearestOffice
          ? {
              id: nearestOffice.id,
              office_name: nearestOffice.office_name,
              address: nearestOffice.address,
              radius: nearestOffice.radius,
            }
          : null,
        distance: nearestDistance ? Math.round(nearestDistance) : null,
      };
    } catch (error) {
      console.error("Error in validateEmployeeOfficeLocation:", error);
      return {
        allowed: false,
        message: "Location validation error",
      };
    }
  },

  addPunchIn: async (
    employeeId,
    device,
    location,
    punchMode,
    orgId,
    lateLogin = false,
  ) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      const lateLoginColumnExists = await attendanceService.hasColumn(
        orgId,
        "emp_attendence",
        "late_login",
      );

      let query = attendanceQueries.ADD_PUNCH_IN;
      let params = [employeeId, device, location, punchMode];

      if (lateLoginColumnExists) {
        query = `
          INSERT INTO emp_attendence (
            employee_id,
            punch_status,
            punchin_time,
            punchin_device,
            punchin_location,
            punchmode,
            late_login
          ) VALUES (?, 'Punch In', NOW(), ?, ?, ?, ?)
        `;
        params = [employeeId, device, location, punchMode, lateLogin ? 1 : 0];
      }

      const [result] = await tenantPool.execute(query, params);
      return result.insertId;
    } catch (error) {
      console.error("Error in addPunchIn:", error);
      throw error;
    }
  },

  updatePunchOut: async (employeeId, device, location, punchMode, orgId) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      const [result] = await tenantPool.execute(
        attendanceQueries.UPDATE_PUNCH_OUT,
        [device, location, punchMode, employeeId],
      );
      return result.affectedRows;
    } catch (error) {
      console.error("Error in updatePunchOut:", error);
      throw error;
    }
  },

  getLastPunchStatus: async (employeeId, orgId) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      const [rows] = await tenantPool.execute(
        attendanceQueries.GET_LAST_PUNCH_STATUS,
        [employeeId],
      );
      return rows.length ? rows[0].punch_status : null;
    } catch (error) {
      console.error("Error in getLastPunchStatus:", error);
      throw error;
    }
  },

  getTodayAttendance: async (orgId) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      const [rows] = await tenantPool.execute(
        attendanceQueries.GET_TODAY_ATTENDANCE,
      );
      return rows;
    } catch (error) {
      console.error("Error in getTodayAttendance:", error);
      throw error;
    }
  },

  getLatestPunchIn: async (employeeId, orgId) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      const [rows] = await tenantPool.execute(
        attendanceQueries.GET_LATEST_PUNCH_IN,
        [employeeId],
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error("Error in getLatestPunchIn:", error);
      throw error;
    }
  },

  getLatestPunchOut: async (employeeId, orgId) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      const [rows] = await tenantPool.execute(
        attendanceQueries.GET_LATEST_PUNCH_OUT,
        [employeeId],
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error("Error in getLatestPunchOut:", error);
      throw error;
    }
  },

  getLoginHoursConfig: async (orgId) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);

      const [rows] = await tenantPool.execute(
        `SELECT *
         FROM login_hours_config
         WHERE org_id = ?
         ORDER BY id DESC
         LIMIT 1`,
        [orgId],
      );

      if (!rows || rows.length === 0) return null;

      const row = rows[0];
      const actionRoles = normalizeActionRoles(row.action_roles);

      return {
        ...row,
        action_roles: actionRoles,
      };
    } catch (error) {
      console.error("Error in getLoginHoursConfig:", error);
      throw error;
    }
  },

  checkAndNotifyAllLateStreaks: async (orgId) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);

      const [employees] = await tenantPool.execute(`
        SELECT DISTINCT e.employee_id 
        FROM emp_attendence ea
        JOIN employees e ON e.employee_id = ea.employee_id
        WHERE ea.late_login = 1 
          AND ea.punchin_time >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
          AND e.status = 'Active'
          AND e.email IS NOT NULL
      `);

      console.log(
        `[streak-cron] Found ${employees.length} employees with late records in org ${orgId}`,
      );

      for (const emp of employees) {
        try {
          const summary = await attendanceService.getLateLoginStreakSummary(
            emp.employee_id,
            orgId,
          );

          const config =
            summary.config ||
            (await attendanceService.getLoginHoursConfig(orgId));
          const streakLimit = Number(config?.late_streak_days || 3);
          const currentStreak = Number(summary.currentStreak || 0);

          if (currentStreak >= streakLimit) {
            console.log(
              `[streak-cron] BREACH → Employee ${emp.employee_id} streak: ${currentStreak}/${streakLimit}`,
            );

            await attendanceService.sendLateLoginStreakNotifications({
              employeeId: emp.employee_id,
              orgId,
              summary,
            });
          }
        } catch (empErr) {
          console.error(
            `[streak-cron] Error processing employee ${emp.employee_id}:`,
            empErr.message,
          );
        }
      }
    } catch (err) {
      console.error(`[streak-cron] Failed for org ${orgId}:`, err.message);
    }
  },

  upsertLoginHoursConfig: async (orgId, config) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);

      const punchInStart =
        config?.punch_in_start ?? config?.punchInStart ?? null;
      const punchOutStart =
        config?.punch_out_start ?? config?.punchOutStart ?? null;
      const bufferMinutes = Number(
        config?.buffer_minutes ?? config?.bufferMinutes ?? 10,
      );
      const lateLoginEnabled =
        config?.late_login_enabled ?? config?.lateLoginEnabled ?? 1;
      const lateStreakDays =
        Number(
          config?.late_streak_days ??
            config?.late_login_streak_days ??
            config?.lateStreakDays ??
            config?.lateLoginStreakDays ??
            3,
        ) || 3;
      const autoMarkLate = config?.auto_mark_late ?? config?.autoMarkLate ?? 1;
      const escalationMode =
        config?.escalation_mode ??
        config?.late_escalation_mode ??
        config?.escalationMode ??
        "mail_notify";
      const actionRoles =
        config?.action_roles ??
        config?.late_action_roles ??
        config?.actionRoles ??
        null;
      const requiredDailyMinutes = Number(
        config?.required_daily_minutes ?? config?.requiredDailyMinutes ?? 480,
      );
      const deficitDetectionEnabled =
        config?.deficit_detection_enabled ??
        config?.deficitDetectionEnabled ??
        1;
      const allowedLateStreaks =
        Number(
          config?.allowed_late_streaks ?? config?.allowedLateStreaks ?? 2,
        ) || 2;
      const streakPeriod =
        config?.streak_period ?? config?.streakPeriod ?? "monthly";

      const actionRolesValue =
        actionRoles && typeof actionRoles === "object"
          ? JSON.stringify(actionRoles)
          : actionRoles ||
            JSON.stringify({ hr: true, manager: true, supervisor: false });

      const params = [
        orgId,
        punchInStart,
        punchOutStart,
        bufferMinutes,
        lateLoginEnabled ? 1 : 0,
        lateStreakDays,
        autoMarkLate ? 1 : 0,
        escalationMode,
        actionRolesValue,
        requiredDailyMinutes,
        deficitDetectionEnabled ? 1 : 0,
        allowedLateStreaks,
        streakPeriod,
      ];

      const [result] = await tenantPool.execute(
        attendanceQueries.UPSERT_LOGIN_HOURS_CONFIG,
        params,
      );

      return result;
    } catch (error) {
      console.error("Error in upsertLoginHoursConfig:", error);
      throw error;
    }
  },

  fetchLatestPunchRecord: async (employeeId, orgId) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      const [rows] = await tenantPool.execute(
        `SELECT employee_id, punch_status, punchin_time, punchin_device, punchin_location,
                punchout_time, punchout_device, punchout_location, punchmode
         FROM emp_attendence
         WHERE employee_id = ?
         ORDER BY GREATEST(
           COALESCE(punchin_time, '0000-00-00'),
           COALESCE(punchout_time, '0000-00-00')
         ) DESC
         LIMIT 1`,
        [employeeId],
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error("Error in fetchLatestPunchRecord:", error);
      throw error;
    }
  },

  getLateLoginRecords: async (employeeId, orgId, daysBack = 90) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      const config = await attendanceService.getLoginHoursConfig(orgId);
      const punchInStart = config?.punch_in_start || "09:00";
      const bufferMinutes = Number(config?.buffer_minutes || 0);

      const [rows] = await tenantPool.execute(
        `SELECT
         DATE(punchin_time) AS late_date,
         TIME_FORMAT(punchin_time, '%H:%i') AS punch_time,
         punchin_time
       FROM emp_attendence
       WHERE employee_id = ?
         AND late_login = 1
         AND punchin_time >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       ORDER BY punchin_time DESC`,
        [employeeId, daysBack],
      );

      return (rows || []).map((r) => {
        const dateKey = formatDateKey(r.late_date);
        const [hh, mm] = String(punchInStart).split(":").map(Number);
        const threshold = new Date(r.punchin_time);
        if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
          threshold.setHours(hh, mm + bufferMinutes, 0, 0);
        }
        const minutesLate = minutesBetween(r.punchin_time, threshold);

        return {
          date: dateKey,
          time: r.punch_time || "--:--",
          minutesLate,
          punchin_time: r.punchin_time,
        };
      });
    } catch (error) {
      console.error("Error in getLateLoginRecords:", error);
      throw error;
    }
  },

  getLateLoginDates: async (employeeId, orgId, daysBack = 90) => {
    const records = await attendanceService.getLateLoginRecords(
      employeeId,
      orgId,
      daysBack,
    );
    return records.map((r) => r.date);
  },

  getEmployeeContactById: async (orgId, employeeId) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);

      const row = await fetchFirstAvailableRow(
        tenantPool,
        [
          `SELECT
             e.employee_id,
             CONCAT_WS(' ', e.first_name, e.middle_name, e.last_name) AS employee_name,
             e.email,
             e.org_id,
             ep.role,
             ep.department_id,
             ep.position,
             ep.supervisor_id
           FROM employees e
           LEFT JOIN employee_professional ep
             ON ep.employee_id = e.employee_id
            AND CAST(ep.sub_org_id AS CHAR) = CAST(e.org_id AS CHAR)
           WHERE e.employee_id = ?
             AND CAST(e.org_id AS CHAR) = CAST(? AS CHAR)
           LIMIT 1`,
        ],
        [employeeId, orgId],
      );

      if (!row) return null;

      return {
        employeeId: row.employee_id ?? employeeId,
        employeeName: row.employee_name || "Employee",
        email: row.email || null,
        role: normalizeRole(row.role || ""),
        departmentId: row.department_id || null,
        position: row.position || null,
        supervisorId: row.supervisor_id || null,
        raw: row,
      };
    } catch (error) {
      console.error("Error in getEmployeeContactById:", error);
      return null;
    }
  },

  getStakeholderRecipients: async (orgId, roles = []) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      const allowedRoles = normalizeActionRoles(roles);

      // Only selected roles. Empty selection → no stakeholder emails.
      if (!allowedRoles.length) return [];

      const placeholders = allowedRoles.map(() => "?").join(",");

      const [rows] = await tenantPool.execute(
        `SELECT DISTINCT
           e.employee_id,
           CONCAT_WS(' ', e.first_name, e.middle_name, e.last_name) AS employee_name,
           e.email,
           ep.role
         FROM employee_professional ep
         JOIN employees e
           ON e.employee_id = ep.employee_id
          AND CAST(e.org_id AS CHAR) = CAST(ep.sub_org_id AS CHAR)
         WHERE LOWER(TRIM(ep.role)) IN (${placeholders})
           AND e.status = 'Active'
           AND e.email IS NOT NULL
           AND e.email <> ''
           AND CAST(e.org_id AS CHAR) = CAST(? AS CHAR)`,
        [...allowedRoles.map((r) => normalizeRole(r)), String(orgId)],
      );

      return uniqByEmail(
        (rows || []).map((row) => ({
          name: row.employee_name || row.email,
          email: row.email,
          role: normalizeRole(row.role),
        })),
      );
    } catch (error) {
      console.error("Error in getStakeholderRecipients:", error);
      return [];
    }
  },

  getAttendanceStatsForPeriod: async (
    employeeId,
    orgId,
    streakPeriod = "monthly",
  ) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      const { startDateKey, label, periodKey } = getPeriodWindow(streakPeriod);

      const [presentRows] = await tenantPool.execute(
        `SELECT COUNT(DISTINCT DATE(punchin_time)) AS present_count
       FROM emp_attendence
       WHERE employee_id = ?
         AND punchin_time >= ?
         AND punch_status IN ('Punch In', 'Punch Out')`,
        [employeeId, startDateKey],
      );

      const [lateRows] = await tenantPool.execute(
        `SELECT COUNT(DISTINCT DATE(punchin_time)) AS late_count
       FROM emp_attendence
       WHERE employee_id = ?
         AND late_login = 1
         AND punchin_time >= ?`,
        [employeeId, startDateKey],
      );

      const start = new Date(startDateKey);
      const end = new Date();
      let workDays = 0;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        if (day !== 0 && day !== 6) workDays += 1;
      }

      const present = Number(presentRows?.[0]?.present_count || 0);
      const late = Number(lateRows?.[0]?.late_count || 0);
      const absent = Math.max(0, workDays - present);

      return {
        present_count: present,
        late_count: late,
        absent_count: absent,
        on_time_count: Math.max(0, present - late),
        period_label: label,
        period_key: periodKey,
        start_date: startDateKey,
      };
    } catch (error) {
      console.error("Error in getAttendanceStatsForPeriod:", error);
      return {
        present_count: 0,
        late_count: 0,
        absent_count: 0,
        on_time_count: 0,
        period_label: "Current period",
        period_key: "monthly",
        start_date: null,
      };
    }
  },

  getOrgAttendanceSummaryForPeriod: async (orgId, streakPeriod = "monthly") => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      const { startDateKey, label } = getPeriodWindow(streakPeriod);

      const [rows] = await tenantPool.execute(
        `SELECT
         e.employee_id,
         CONCAT_WS(' ', e.first_name, e.middle_name, e.last_name) AS employee_name,
         e.email,
         COUNT(DISTINCT DATE(ea.punchin_time)) AS present_days,
         COUNT(DISTINCT CASE WHEN ea.late_login = 1 THEN DATE(ea.punchin_time) END) AS late_days
       FROM employees e
       LEFT JOIN emp_attendence ea
         ON ea.employee_id = e.employee_id
        AND ea.punchin_time >= ?
       WHERE e.status = 'Active'
         AND CAST(e.org_id AS CHAR) = CAST(? AS CHAR)
       GROUP BY e.employee_id, e.first_name, e.middle_name, e.last_name, e.email
       ORDER BY late_days DESC, employee_name ASC
       LIMIT 50`,
        [startDateKey, String(orgId)],
      );

      return {
        period_label: label,
        employees: (rows || []).map((r) => ({
          employeeId: r.employee_id,
          employeeName: r.employee_name || "Employee",
          email: r.email,
          presentDays: Number(r.present_days || 0),
          lateDays: Number(r.late_days || 0),
        })),
      };
    } catch (error) {
      console.error("Error in getOrgAttendanceSummaryForPeriod:", error);
      return { period_label: "Current period", employees: [] };
    }
  },

  getLateLoginStreakSummary: async (employeeId, orgId, daysBack = 90) => {
    try {
      const [config, contact] = await Promise.all([
        attendanceService.getLoginHoursConfig(orgId),
        attendanceService.getEmployeeContactById(orgId, employeeId),
      ]);

      const streakPeriod = config?.streak_period || "monthly";
      const periodWindow = getPeriodWindow(streakPeriod);

      const lateRecords = await attendanceService.getLateLoginRecords(
        employeeId,
        orgId,
        daysBack,
      );
      const lateDateKeys = lateRecords.map((r) => r.date);
      const streak = consecutiveLateStreak(lateDateKeys);

      const stats = await attendanceService.getAttendanceStatsForPeriod(
        employeeId,
        orgId,
        streakPeriod,
      );

      const periodLateRecords = lateRecords.filter(
        (r) => r.date >= periodWindow.startDateKey,
      );

      const orgName = await getOrganizationName(orgId);

      return {
        employeeId,
        employeeName: contact?.employeeName || "Employee",
        employeeEmail: contact?.email || null,
        lateDates: periodLateRecords,
        lateDateKeys,
        currentStreak: streak,
        streakLimit: Number(config?.late_streak_days || 0),
        orgName,
        punchInStart: config?.punch_in_start || "",
        punchOutStart: config?.punch_out_start || "",
        bufferMinutes: config?.buffer_minutes || 0,
        config,
        contact,
        stats: {
          present_count: stats.present_count,
          absent_count: stats.absent_count,
          late_count: stats.late_count,
          on_time_count: stats.on_time_count,
        },
        onTimeCount: stats.on_time_count,
        absentCount: stats.absent_count,
        periodLabel: stats.period_label,
        periodKey: stats.period_key,
        streakPeriod,
      };
    } catch (error) {
      console.error("Error in getLateLoginStreakSummary:", error);
      throw error;
    }
  },

  sendLateLoginStreakNotifications: async ({
    employeeId,
    orgId,
    summary = null,
    stakeholderRecipients = null,
  }) => {
    try {
      const latestSummary =
        summary ||
        (await attendanceService.getLateLoginStreakSummary(employeeId, orgId));

      const config =
        latestSummary.config ||
        (await attendanceService.getLoginHoursConfig(orgId));

      const streakLimit = Number(config?.late_streak_days || 0);
      const currentStreak = Number(latestSummary.currentStreak || 0);

      if (!streakLimit || currentStreak < streakLimit) {
        return {
          sent: false,
          reason: "Streak limit not breached.",
          summary: latestSummary,
        };
      }

      const employeeContact =
        latestSummary.contact ||
        (await attendanceService.getEmployeeContactById(orgId, employeeId));

      const employeeEmail =
        latestSummary.employeeEmail || employeeContact?.email;

      const allowedRoles = normalizeActionRoles(config?.action_roles);

      let recipients = stakeholderRecipients;
      if (!Array.isArray(recipients)) {
        // Pass only configured roles — empty list means no stakeholder mails
        recipients = await attendanceService.getStakeholderRecipients(
          orgId,
          allowedRoles,
        );
      }

      // Keep only people whose role is in the selected action_roles list
      const filteredStakeholders = (recipients || []).filter((r) => {
        if (!allowedRoles.length) return false;
        const role = normalizeRole(r.role || "");
        return allowedRoles.includes(role);
      });
      const mailConfig = {
        ...config,
        action_roles: allowedRoles,
      };

      const orgName = await getOrganizationName(orgId);

      let orgSummary = null;
      try {
        orgSummary = await attendanceService.getOrgAttendanceSummaryForPeriod(
          orgId,
          latestSummary.streakPeriod || config?.streak_period || "monthly",
        );
      } catch (_) {
        orgSummary = null;
      }

      let employeeMailSent = false;
      if (employeeEmail) {
        employeeMailSent = await sendLateLoginEmployeeAlert({
          employeeEmail,
          employeeName:
            employeeContact?.employeeName || latestSummary.employeeName,
          orgName: orgName,
          summary: latestSummary,
          config: mailConfig,
        });
      }

      const stakeholderMailSent = await sendLateLoginStakeholderAlert({
        recipients: filteredStakeholders,
        orgName: orgName,
        employeeName:
          employeeContact?.employeeName || latestSummary.employeeName,
        summary: latestSummary,
        config: mailConfig,
        orgSummary,
      });

      return {
        sent: employeeMailSent || stakeholderMailSent,
        reason:
          employeeMailSent || stakeholderMailSent
            ? undefined
            : "No late-login email recipients were available.",
        summary: latestSummary,
        employeeMailSent,
        stakeholderMailSent,
        recipients: filteredStakeholders.map((r) => r.email),
      };
    } catch (error) {
      console.error("Error in sendLateLoginStreakNotifications:", error);
      throw error;
    }
  },

  recordAndNotifyLateLogin: async ({
    employeeId,
    orgId,
    device,
    location,
    punchMode,
  }) => {
    try {
      const lateLoginColumnExists = await attendanceService.hasColumn(
        orgId,
        "emp_attendence",
        "late_login",
      );

      const config = await attendanceService.getLoginHoursConfig(orgId);

      const punchInStart = config?.punch_in_start || null;
      const bufferMinutes = Number(config?.buffer_minutes || 0);
      const lateEnabled = String(config?.late_login_enabled ?? "1") !== "0";
      const autoMarkLate = String(config?.auto_mark_late ?? "1") !== "0";
      const escalationMode = String(config?.escalation_mode || "mail_notify");

      let lateLogin = false;

      if (lateEnabled && punchInStart) {
        const now = new Date();
        const [hh, mm] = String(punchInStart)
          .split(":")
          .map((n) => Number(n));

        if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
          const threshold = new Date(now);
          threshold.setHours(hh, mm + bufferMinutes, 0, 0);
          lateLogin = autoMarkLate && now > threshold;
        }
      }

      const insertId = await attendanceService.addPunchIn(
        employeeId,
        device,
        location,
        punchMode,
        orgId,
        lateLogin && lateLoginColumnExists,
      );

      const summary = await attendanceService.getLateLoginStreakSummary(
        employeeId,
        orgId,
      );

      const employeeContact =
        summary.contact ||
        (await attendanceService.getEmployeeContactById(orgId, employeeId));

      const streakLimit = Number(config?.late_streak_days || 0);
      const streakBreached =
        streakLimit > 0 && Number(summary.currentStreak || 0) >= streakLimit;

      let employeeMailSent = false;
      let stakeholderMailSent = false;

      if (escalationMode === "mail_notify") {
        const allowedRoles = normalizeActionRoles(config?.action_roles);
        const mailConfig = {
          ...config,
          action_roles: allowedRoles,
        };

        const orgName = await getOrganizationName(orgId);

        if (lateLogin) {
          try {
            employeeMailSent = await sendLateLoginEmployeeAlert({
              employeeEmail: employeeContact?.email || summary.employeeEmail,
              employeeName:
                employeeContact?.employeeName || summary.employeeName,
              orgName: orgName,
              summary,
              config: mailConfig,
            });
          } catch (mailErr) {
            console.error("Late-login employee mail failed:", mailErr);
          }
        }

        if (streakBreached) {
          try {
            const stakeholders =
              await attendanceService.getStakeholderRecipients(
                orgId,
                allowedRoles,
              );

            let orgSummary = null;
            try {
              orgSummary =
                await attendanceService.getOrgAttendanceSummaryForPeriod(
                  orgId,
                  summary.streakPeriod || config?.streak_period || "monthly",
                );
            } catch (_) {
              orgSummary = null;
            }

            stakeholderMailSent = await sendLateLoginStakeholderAlert({
              recipients: stakeholders,
              orgName: orgName,
              employeeName:
                employeeContact?.employeeName || summary.employeeName,
              summary,
              config: mailConfig,
              orgSummary,
            });
          } catch (mailErr) {
            console.error("Late-login stakeholder mail failed:", mailErr);
          }
        }
      }

      return {
        insertId,
        lateLogin,
        streakBreached,
        employeeMailSent,
        stakeholderMailSent,
        summary,
        escalationMode,
      };
    } catch (error) {
      console.error("Error in recordAndNotifyLateLogin:", error);
      throw error;
    }
  },
};

module.exports = attendanceService;
