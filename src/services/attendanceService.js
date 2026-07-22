const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const attendanceQueries = require("../constants/attendanceQueries");
const { sendWithRetries } = require("../utils/brevoMailer");
const orgService = require("./orgService");
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

function buildPieChartSvg(summary = {}) {
  const late = Math.max(0, Number(summary.lateCount || 0));
  const onTime = Math.max(0, Number(summary.onTimeCount || 0));
  const absent = Math.max(0, Number(summary.absentCount || 0));
  const total = Math.max(late + onTime + absent, 1);

  const radius = 46;
  const circumference = 2 * Math.PI * radius;

  const lateLen = (late / total) * circumference;
  const onTimeLen = (onTime / total) * circumference;
  const absentLen = Math.max(circumference - lateLen - onTimeLen, 0);

  const onTimeOffset = circumference - lateLen;
  const absentOffset = circumference - lateLen - onTimeLen;

  const latePct = Math.round((late / total) * 100);
  const onTimePct = Math.round((onTime / total) * 100);
  const absentPct = Math.round((absent / total) * 100);

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="620" height="240" viewBox="0 0 620 240">
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
      <text x="24" y="12" font-size="12" fill="#334155">Late: ${late} (${latePct}%)</text>
      <circle cx="146" cy="8" r="6" fill="#22c55e"/>
      <text x="162" y="12" font-size="12" fill="#334155">On time: ${onTime} (${onTimePct}%)</text>
      <circle cx="8" cy="38" r="6" fill="#f59e0b"/>
      <text x="24" y="42" font-size="12" fill="#334155">Absent: ${absent} (${absentPct}%)</text>
    </g>
  </svg>`;
}

async function svgToPngDataUri(svg) {
  try {
    // eslint-disable-next-line global-require
    const sharp = require("sharp");
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch (err) {
    return null;
  }
}

async function svgToPngFile(svg, outDir, fileName) {
  try {
    await fs.promises.mkdir(outDir, { recursive: true });
    // eslint-disable-next-line global-require
    const sharp = require("sharp");
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    const outPath = path.join(outDir, fileName);
    await fs.promises.writeFile(outPath, buf);
    return outPath;
  } catch (err) {
    return null;
  }
}

async function sendHtmlMail({ to, subject, htmlContent, textContent, cc }) {
  const senderName =
    process.env.SMTP_SENDER_NAME || process.env.PLATFORM_NAME || "PULSEWORK";

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
  chartOverride = null,
}) {
  const streak = Number(summary.currentStreak || 0);
  const limit = Number(summary.streakLimit ?? config?.late_streak_days ?? 0);
  const lateDates = Array.isArray(summary.lateDates) ? summary.lateDates : [];
  const punchInStart =
    summary.punchInStart || config?.punch_in_start || "--:--";
  const punchOutStart =
    summary.punchOutStart || config?.punch_out_start || "--:--";
  const bufferMinutes = summary.bufferMinutes ?? config?.buffer_minutes ?? 0;
  const escalationMode = config?.escalation_mode || "mail_notify";
  const actionRoles = normalizeActionRoles(config?.action_roles);

  const headerOrgName = escapeHtml(
    String(orgName || "")
      .replace(/\s*\d+$/, "")
      .trim() || "Organization",
  );

  const chartSvg = buildPieChartSvg({
    lateCount: lateDates.length,
    onTimeCount: summary.onTimeCount || 0,
    absentCount: summary.absentCount || 0,
  });
  // Build an HTML-based attendance snapshot (more email-client friendly than SVG)
  const late = Math.max(0, Number(lateDates.length || 0));
  const onTime = Math.max(0, Number(summary.onTimeCount || 0));
  const absent = Math.max(0, Number(summary.absentCount || 0));
  const total = Math.max(late + onTime + absent, 1);
  const latePct = Math.round((late / total) * 100);
  const onTimePct = Math.round((onTime / total) * 100);
  const absentPct = Math.round((absent / total) * 100);

  const attendanceHtml = `
    <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;">
      <div style="width:116px;min-width:96px;text-align:center;padding:12px;border-radius:14px;border:1px solid #e5e7eb;background:#fff;">
        <div style="width:72px;height:72px;border-radius:50%;margin:0 auto;background:#fff;border:6px solid #f1f5f9;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;color:#0f172a;">${total}</div>
        <div style="font-size:11px;color:#64748b;margin-top:6px;">records</div>
      </div>

      <div style="flex:1;min-width:240px;">
        <div style="font-size:18px;font-weight:700;color:#0f172a;margin-bottom:6px;">Attendance snapshot</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:10px;">Late / On time / Absent</div>

        <div style="background:#f8fafc;border-radius:10px;overflow:hidden;height:28px;display:flex;border:1px solid #eef2f7;">
          <div style="width:${Math.max(0, latePct)}%;background:#ef4444;"></div>
          <div style="width:${Math.max(0, onTimePct)}%;background:#22c55e;"></div>
          <div style="width:${Math.max(0, absentPct)}%;background:#f59e0b;"></div>
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:12px;font-size:13px;color:#334155;">
          <div style="display:flex;align-items:center;gap:8px;min-width:140px;"><span style="width:10px;height:10px;background:#ef4444;border-radius:50%;display:inline-block;"></span> Late: ${late} (${latePct}%)</div>
          <div style="display:flex;align-items:center;gap:8px;min-width:140px;"><span style="width:10px;height:10px;background:#22c55e;border-radius:50%;display:inline-block;"></span> On time: ${onTime} (${onTimePct}%)</div>
          <div style="display:flex;align-items:center;gap:8px;min-width:140px;"><span style="width:10px;height:10px;background:#f59e0b;border-radius:50%;display:inline-block;"></span> Absent: ${absent} (${absentPct}%)</div>
        </div>
      </div>
    </div>
  `;

  // Prefer an explicit override if provided, otherwise use the HTML snapshot
  const chartInline = chartOverride || attendanceHtml;

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
    : `<div style="color:#64748b;font-size:13px;">No late dates found.</div>`;

  return `<!doctype html>
  <html>
    <head><meta charset="utf-8" /></head>
    <body style="font-family:Arial,Helvetica,sans-serif;background:#f6f7fb;margin:0;padding:24px;color:#1f2937;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:760px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:22px 24px;background:linear-gradient(135deg,#0f172a,#1d4ed8);color:#fff;">
            <div style="font-size:24px;font-weight:800;margin-top:6px;">${escapeHtml(title)}</div>
            <div style="font-size:15px;opacity:0.95;margin-top:6px;">${headerOrgName}</div>
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

            <div style="margin-top:18px;border:1px solid #e5e7eb;border-radius:18px;padding:18px;background:#ffffff;display:flex;justify-content:center;">
              ${chartInline}
            </div>

            <div style="margin-top:18px;border:1px solid #e5e7eb;border-radius:18px;padding:18px;background:#f8fafc;">
              <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:8px;">Recent late dates</div>
              ${lateDatesHtml}
            </div>

            <div style="margin-top:18px;font-size:13px;line-height:1.7;color:#475569;">
              Punch-out start: <strong>${escapeHtml(punchOutStart)}</strong><br/>
                Escalation mode: <strong>${escapeHtml(escalationMode)}</strong>
            </div>

            <p style="margin-top:18px;font-size:13px;color:#64748b;line-height:1.7;">
              This is an automated alert from ${escapeHtml(process.env.PLATFORM_NAME || "PULSEWORK")}. Please review the attendance dashboard for full details.
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
  const lateDates = Array.isArray(summary.lateDates) ? summary.lateDates : [];
  const punchInStart =
    summary.punchInStart || config?.punch_in_start || "--:--";
  const punchOutStart =
    summary.punchOutStart || config?.punch_out_start || "--:--";
  const bufferMinutes = summary.bufferMinutes ?? config?.buffer_minutes ?? 0;
  const escalationMode = config?.escalation_mode || "mail_notify";

  return `${process.env.PLATFORM_NAME || "PULSEWORK"} - ${recipientType === "employee" ? "Late login alert" : "Attendance escalation alert"}

Organization: ${orgName || "Organization"}
Employee: ${employeeName || "Employee"}
Current streak: ${streak}
Streak limit: ${limit}
Punch-in start: ${punchInStart}
Punch-out start: ${punchOutStart}
Buffer minutes: ${bufferMinutes}
Escalation mode: ${escalationMode}

Late dates:
${lateDates.length ? lateDates.join(", ") : "N/A"}
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

  const chartSvg = buildPieChartSvg({
    lateCount: Array.isArray(summary?.lateDates)
      ? summary.lateDates.length
      : Number(summary?.lateCount || 0),
    onTimeCount: summary?.onTimeCount || 0,
    absentCount: summary?.absentCount || 0,
  });

  let chartOverride = null;
  // Embed SVG markup directly — more reliable across mail providers than data URIs
  chartOverride = `<div style="display:block;width:100%;max-width:560px;margin:0 auto;">${chartSvg}</div>`;

  await sendHtmlMail({
    to: [{ email: employeeEmail, name: employeeName || employeeEmail }],
    subject: `${process.env.PLATFORM_NAME || "PULSEWORK"} — Late login alert`,
    htmlContent: buildLateLoginHtml({
      title: "Late login alert",
      recipientType: "employee",
      orgName,
      employeeName,
      summary,
      config,
      chartOverride,
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
}) {
  const uniqueRecipients = uniqByEmail(
    (recipients || []).map((r) => ({
      email: r.email,
      name: r.name || r.email,
    })),
  );

  if (!uniqueRecipients.length) return false;

  const chartSvg = buildPieChartSvg({
    lateCount: Array.isArray(summary?.lateDates)
      ? summary.lateDates.length
      : Number(summary?.lateCount || 0),
    onTimeCount: summary?.onTimeCount || 0,
    absentCount: summary?.absentCount || 0,
  });

  let chartOverride = null;
  // Embed SVG markup directly — more reliable across mail providers than data URIs
  chartOverride = `<div style="display:block;width:100%;max-width:560px;margin:0 auto;">${chartSvg}</div>`;

  await sendHtmlMail({
    to: uniqueRecipients,
    subject: `${process.env.PLATFORM_NAME || "PULSEWORK"} — Late login escalation`,
    htmlContent: buildLateLoginHtml({
      title: "Attendance escalation alert",
      recipientType: "stakeholder",
      orgName,
      employeeName,
      summary,
      config,
      chartOverride,
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

  // UPDATED: Mobile Only for Assigned Employees
  validateEmployeeOfficeLocation: async (
    employeeId,
    latitude,
    longitude,
    orgId,
    device, // NEW: device type
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
        Number(config?.late_login_streak_days ?? config?.lateStreakDays ?? 3) ||
        3;
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

  getLateLoginDates: async (employeeId, orgId, daysBack = 90) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      const [rows] = await tenantPool.execute(
        `SELECT DISTINCT DATE(punchin_time) as late_date
         FROM emp_attendence
         WHERE employee_id = ?
           AND late_login = 1
           AND punchin_time >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         ORDER BY late_date DESC`,
        [employeeId, daysBack],
      );

      return rows.map((r) => formatDateKey(r.late_date));
    } catch (error) {
      console.error("Error in getLateLoginDates:", error);
      throw error;
    }
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

  getStakeholderRecipients: async (orgId, roles = ROLE_PRIORITY) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);
      const roleList = normalizeActionRoles(roles);
      const allowedRoles = roleList.length ? roleList : ROLE_PRIORITY;
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

  getLateLoginStreakSummary: async (employeeId, orgId, daysBack = 90) => {
    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);

      // Fetch all required data
      const [lateDatesResult, config, contact, statsResult] = await Promise.all(
        [
          attendanceService.getLateLoginDates(employeeId, orgId, daysBack),
          attendanceService.getLoginHoursConfig(orgId),
          attendanceService.getEmployeeContactById(orgId, employeeId),
          tenantPool.execute(attendanceQueries.GET_ATTENDANCE_STATS, [
            employeeId,
            employeeId,
            employeeId,
            employeeId,
          ]),
        ],
      );

      const lateDates = lateDatesResult || [];
      const stats = statsResult?.[0]?.[0] || {}; // Safe access
      const streak = consecutiveLateStreak(lateDates);

      // Fetch organization name
      let orgName = "Organization";
      try {
        const masterDb = require("../config");
        const [rows] = await masterDb.query(
          `SELECT name FROM organizations WHERE id = ? LIMIT 1`,
          [orgId],
        );
        if (rows?.length > 0) orgName = rows[0].name || "Organization";
      } catch (e) {
        console.warn(
          `[getLateLoginStreakSummary] Org name fetch failed:`,
          e.message,
        );
      }

      return {
        employeeId,
        employeeName: contact?.employeeName || "Employee",
        employeeEmail: contact?.email || null,
        lateDates,
        currentStreak: streak,
        streakLimit: Number(config?.late_streak_days || 0),
        orgName,
        punchInStart: config?.punch_in_start || "",
        punchOutStart: config?.punch_out_start || "",
        bufferMinutes: config?.buffer_minutes || 0,
        config,
        contact,
        stats, // ← Full monthly stats
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

      let recipients = stakeholderRecipients;
      const allowedRoles = normalizeActionRoles(config?.action_roles);

      if (!Array.isArray(recipients)) {
        recipients = await attendanceService.getStakeholderRecipients(
          orgId,
          allowedRoles.length ? allowedRoles : ROLE_PRIORITY,
        );
      }

      const filteredStakeholders = (recipients || []).filter((r) => {
        const role = normalizeRole(r.role || "");
        if (allowedRoles.length === 0) {
          return true;
        }
        return allowedRoles.includes(role);
      });

      const mailConfig = {
        ...config,
        action_roles: allowedRoles,
      };

      // fetch organization name for header if available
      let orgRow = null;
      try {
        orgRow = await orgService.getOrgNameById(orgId);
      } catch (_) {
        orgRow = null;
      }
      const orgNameStr =
        orgRow?.name || latestSummary.orgName || `Organization ${orgId}`;

      let employeeMailSent = false;
      if (employeeEmail) {
        employeeMailSent = await sendLateLoginEmployeeAlert({
          employeeEmail,
          employeeName:
            employeeContact?.employeeName || latestSummary.employeeName,
          orgName: orgNameStr,
          summary: latestSummary,
          config: mailConfig,
        });
      }

      const stakeholderMailSent = await sendLateLoginStakeholderAlert({
        recipients: filteredStakeholders,
        orgName: orgNameStr,
        employeeName:
          employeeContact?.employeeName || latestSummary.employeeName,
        summary: latestSummary,
        config: mailConfig,
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

        // fetch organization name for header (used for both employee and stakeholder emails)
        let orgRow = null;
        try {
          orgRow = await orgService.getOrgNameById(orgId);
        } catch (_) {
          orgRow = null;
        }
        const orgNameStr = orgRow?.name || `Organization ${orgId}`;

        if (lateLogin) {
          try {
            employeeMailSent = await sendLateLoginEmployeeAlert({
              employeeEmail: employeeContact?.email || summary.employeeEmail,
              employeeName:
                employeeContact?.employeeName || summary.employeeName,
              orgName: orgNameStr,
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
                allowedRoles.length ? allowedRoles : ROLE_PRIORITY,
              );

            stakeholderMailSent = await sendLateLoginStakeholderAlert({
              recipients: stakeholders,
              orgName: orgNameStr,
              employeeName:
                employeeContact?.employeeName || summary.employeeName,
              summary,
              config: mailConfig,
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
