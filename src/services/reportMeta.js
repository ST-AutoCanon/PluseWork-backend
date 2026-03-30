const escapeHtml = (s) => {
  if (s === undefined || s === null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

function formatTimestampAsiaKolkata(d = new Date()) {
  const s = d.toLocaleString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour12: false,
  });
  const parts = s.split(",").map((p) => p.trim());
  const datePart = parts[0];
  const timePart = parts[1] || "";
  const dp = datePart.split("/");
  if (dp.length === 3) {
    const [dd, mm, yyyy] = dp;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(
      2,
      "0",
    )} ${timePart} (Asia/Kolkata)`;
  }
  return `${s} (Asia/Kolkata)`;
}

function generateMetaHtml(meta = {}) {
  const status =
    meta.status === null || meta.status === undefined
      ? ""
      : escapeHtml(String(meta.status));
  const dept =
    meta.departmentName === null || meta.departmentName === undefined
      ? ""
      : escapeHtml(String(meta.departmentName));

  // First check if meta.employee already has the combined format (e.g., from Leaves handler)
  let employee =
    meta.employee !== null && meta.employee !== undefined
      ? escapeHtml(String(meta.employee))
      : "";

  // If no pre-formatted employee, try to combine employeeName and employeeId
  if (!employee) {
    let employeeName =
      meta.employeeName === null || meta.employeeName === undefined
        ? ""
        : escapeHtml(String(meta.employeeName));

    const employeeId =
      meta.employeeId === null || meta.employeeId === undefined
        ? ""
        : escapeHtml(String(meta.employeeId));

    // If we have both name and ID, combine them in format "Name (ID)"
    if (employeeName && employeeId && !employeeName.includes(employeeId)) {
      employee = `${employeeName} (${employeeId})`;
    } else if (!employeeName && employeeId) {
      // If only ID exists, use it
      employee = employeeId;
    } else if (employeeName) {
      employee = employeeName;
    }
  }

  const timestamp = formatTimestampAsiaKolkata();

  const leftItems = [];
  if (status)
    leftItems.push(
      `<div class="meta-item"><strong>Status:</strong> ${status}</div>`,
    );
  if (dept)
    leftItems.push(
      `<div class="meta-item"><strong>Department:</strong> ${dept}</div>`,
    );
  if (employee)
    leftItems.push(
      `<div class="meta-item"><strong>Employee:</strong> ${employee}</div>`,
    );

  const leftHtml = leftItems.length
    ? leftItems.join("")
    : `<div class="meta-item"><em>No filters</em></div>`;

  return `
  <div class="report-meta" style="margin: 8px 0 14px 0; font-family: Arial, Helvetica, sans-serif;">
    <style>
      
      .report-meta { display: flex; justify-content: space-between; align-items: flex-start; width: 100%; box-sizing: border-box; }
      .report-meta .meta-left { display: flex; flex-direction: column; gap: 4px; }
      .report-meta .meta-item { font-size: 12px; color: #333; line-height: 1.2; }
      .report-meta .meta-right { text-align: right; min-width: 200px; }
      .report-meta .time { font-size: 11px; color: #666; font-family: monospace; }
      
      @media (max-width: 480px) {
        .report-meta { flex-direction: column; gap: 8px; align-items: stretch; }
        .report-meta .meta-right { text-align: left; min-width: auto; }
      }
    </style>

    <div class="meta-left">
      ${leftHtml}
    </div>

    <div class="meta-right">
      <div class="time"><strong>Generated:</strong><br>${escapeHtml(
        timestamp,
      )}</div>
    </div>
  </div>
  `;
}

module.exports = {
  generateMetaHtml,
  formatTimestampAsiaKolkata,
  escapeHtml,
};
