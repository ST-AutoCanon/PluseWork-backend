const fs = require("fs");
const os = require("os");
const path = require("path");
const util = require("util");
const child_process = require("child_process");
const execFile = util.promisify(child_process.execFile);
const spawnSync = child_process.spawnSync;

const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const PDFLib = require("pdf-lib");

function pruneEmptyColumnsFromData(rows, columns) {
  if (!Array.isArray(columns) || columns.length === 0)
    return { columns: [], keptIndexes: [] };
  const kept = [];
  const keptIdx = [];
  for (let i = 0; i < columns.length; i++) {
    const key = columns[i].key;
    let hasNonEmpty = false;
    for (let r = 0; r < rows.length; r++) {
      const val = rows[r][key];
      if (val !== null && val !== undefined && String(val).trim() !== "") {
        hasNonEmpty = true;
        break;
      }
    }
    if (hasNonEmpty) {
      kept.push(columns[i]);
      keptIdx.push(i);
    }
  }
  if (kept.length === 0) {
    return {
      columns: columns.slice(),
      keptIndexes: columns.map((_, i) => i),
    };
  }
  return { columns: kept, keptIndexes: keptIdx };
}

function computeAutoWidthForColumn(rows, key, header) {
  const minWidth = 5;
  const maxWidth = 80;
  let maxLen = String(header || "").length;
  for (let i = 0; i < rows.length; i++) {
    const v = rows[i][key];
    if (v === null || v === undefined) continue;
    const s = String(v);
    if (s.length > maxLen) maxLen = s.length;
  }
  const width = Math.ceil(Math.min(maxWidth, Math.max(minWidth, maxLen * 1.1)));
  return width;
}

async function renderExcelBuffer(rows, headers) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");
  const safeRows = Array.isArray(rows) ? rows.map((r) => ({ ...r })) : [];
  let cols;
  if (Array.isArray(headers) && headers.length > 0) {
    cols = headers.map((h) => {
      if (typeof h === "string") return { header: h, key: h, width: 20 };
      return {
        header: h.header || h.key || h,
        key: h.key || h.header || h,
        width: h.width || 20,
      };
    });
  } else if (safeRows.length > 0) {
    cols = Object.keys(safeRows[0]).map((k) => ({
      header: k,
      key: k,
      width: 20,
    }));
  } else {
    cols = [{ header: "Message", key: "message", width: 50 }];
    safeRows.push({ message: "No data available for selected range" });
  }
  const pruned = pruneEmptyColumnsFromData(safeRows, cols);
  const finalCols = pruned.columns.length > 0 ? pruned.columns : cols;
  finalCols.forEach((c) => {
    c.width = computeAutoWidthForColumn(safeRows, c.key, c.header);
  });
  sheet.columns = finalCols.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width,
  }));
  for (const r of safeRows) {
    const rowObj = {};
    for (const c of finalCols) {
      rowObj[c.key] = Object.prototype.hasOwnProperty.call(r, c.key)
        ? r[c.key]
        : "";
    }
    sheet.addRow(rowObj);
  }
  sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

async function renderTasksExcelBuffer(tasksRows, weeklyRows) {
  const workbook = new ExcelJS.Workbook();

  function unionKeysFromRows(rowsArray) {
    const seen = new Set();
    const keys = [];
    for (const r of rowsArray) {
      if (!r || typeof r !== "object") continue;
      for (const k of Object.keys(r)) {
        if (!seen.has(k)) {
          seen.add(k);
          keys.push(k);
        }
      }
    }
    return keys;
  }

  function addSheet(name, rows, fallbackRows = []) {
    let safeRows = Array.isArray(rows) ? rows.map((r) => ({ ...r })) : [];
    const fallbackSafe = Array.isArray(fallbackRows)
      ? fallbackRows.map((r) => ({ ...r }))
      : [];

    let cols;

    let usedRowsForCols = safeRows.length > 0 ? safeRows : fallbackSafe;
    if (safeRows.length === 0 && fallbackSafe.length > 0) {
      safeRows = fallbackSafe.slice();
    }

    if (usedRowsForCols.length > 0) {
      const keys = unionKeysFromRows(usedRowsForCols);
      cols = keys.map((k) => ({ header: k, key: k, width: 20 }));
    } else {
      cols = [{ header: "Message", key: "message", width: 50 }];
      safeRows.push({ message: "No data available for selected range" });
    }

    const pruned = pruneEmptyColumnsFromData(safeRows, cols);
    const finalCols = pruned.columns.length > 0 ? pruned.columns : cols;
    finalCols.forEach((c) => {
      c.width = computeAutoWidthForColumn(safeRows, c.key, c.header);
    });

    const sheet = workbook.addWorksheet(name);
    sheet.columns = finalCols.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width,
    }));
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

    for (const r of safeRows) {
      const rowObj = {};
      for (const c of finalCols) {
        rowObj[c.key] = Object.prototype.hasOwnProperty.call(r, c.key)
          ? r[c.key]
          : "";
      }
      sheet.addRow(rowObj);
    }
  }

  addSheet("Tasks", tasksRows, weeklyRows);
  addSheet("Weekly Tasks", weeklyRows, tasksRows);

  const buf = await workbook.xlsx.writeBuffer();
  return buf;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function computeColumnPercents(rows) {
  if (!rows || rows.length === 0) return [];
  const headers = Object.keys(rows[0] || {});
  if (!headers.length) return [];
  const count = headers.length;
  const base = 100 / count;
  const percents = headers.map(() => base);
  const sum = percents.reduce((s, v) => s + v, 0);
  const diff = 100 - sum;
  if (Math.abs(diff) > 1e-9)
    percents[percents.length - 1] = percents[percents.length - 1] + diff;
  return percents.map((p) => Math.round(p * 100) / 100);
}

function formatTimestampAsiaKolkata(d = new Date()) {
  try {
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
  } catch (e) {
    const iso = new Date().toISOString().slice(0, 19).replace("T", " ");
    return `${iso} (UTC)`;
  }
}

function generateMetaHeaderHtml(headerInfo) {
  const rawStatus =
    headerInfo && headerInfo.status ? headerInfo.status : headerInfo?.status;
  let status = rawStatus;
  if (typeof status === "object" && status !== null) {
    status =
      status.name ||
      status.status ||
      (status.value ? String(status.value) : "");
  }
  status = status ? String(status).trim() : "";

  let dept = "";
  if (headerInfo && headerInfo.department) {
    if (typeof headerInfo.department === "string") dept = headerInfo.department;
    else if (
      typeof headerInfo.department === "object" &&
      headerInfo.department
    ) {
      dept =
        headerInfo.department.name ||
        headerInfo.department.department_name ||
        headerInfo.department.departmentName ||
        headerInfo.department.id ||
        "";
    } else dept = String(headerInfo.department || "");
  } else if (headerInfo && headerInfo.departmentName) {
    dept = String(headerInfo.departmentName || "");
  }

  let employee = "";
  if (headerInfo && headerInfo.employeeName) {
    employee = String(headerInfo.employeeName || "");
  } else if (headerInfo && headerInfo.employee) {
    if (typeof headerInfo.employee === "string") employee = headerInfo.employee;
    else if (typeof headerInfo.employee === "object" && headerInfo.employee) {
      employee =
        headerInfo.employee.name ||
        headerInfo.employee.employee_name ||
        headerInfo.employee.full_name ||
        headerInfo.employee.email ||
        headerInfo.employee.id ||
        "";
    }
  } else if (headerInfo && headerInfo.employee_name) {
    employee = String(headerInfo.employee_name || "");
  }

  const timestamp = escapeHtml(formatTimestampAsiaKolkata(new Date()));
  const isAllStatus =
    typeof status === "string" && status.trim().toLowerCase() === "all";

  const leftItems = [];
  if (isAllStatus) {
    if (employee)
      leftItems.push(
        `<div class="meta-item"><strong>Employee:</strong> ${escapeHtml(
          employee,
        )}</div>`,
      );
    if (dept)
      leftItems.push(
        `<div class="meta-item"><strong>Department:</strong> ${escapeHtml(
          dept,
        )}</div>`,
      );
    if (status)
      leftItems.push(
        `<div class="meta-item"><strong>Status:</strong> ${escapeHtml(
          status,
        )}</div>`,
      );
  } else {
    if (status)
      leftItems.push(
        `<div class="meta-item"><strong>Status:</strong> ${escapeHtml(
          status,
        )}</div>`,
      );
    if (dept)
      leftItems.push(
        `<div class="meta-item"><strong>Department:</strong> ${escapeHtml(
          dept,
        )}</div>`,
      );
    if (employee)
      leftItems.push(
        `<div class="meta-item"><strong>Employee:</strong> ${escapeHtml(
          employee,
        )}</div>`,
      );
  }

  const leftHtml = leftItems.length
    ? leftItems.join("")
    : `<div class="meta-item"><em>No filters</em></div>`;

  const centerMeta = headerInfo && headerInfo._smallCentered === true;

  const html = `
    <div class="report-meta" style="margin: 8px 0 12px 0; font-family: Arial, Helvetica, sans-serif;">
      <style>
        .report-meta { display: flex; justify-content: space-between; align-items: flex-start; width: 100%; box-sizing: border-box; }
        .report-meta.center { justify-content: center; align-items: center; text-align: center; }
        .report-meta .meta-left { display: flex; flex-direction: column; gap: 4px; }
        .report-meta .meta-item { font-size: 12px; color: #333; line-height: 1.2; }
        .report-meta .meta-right { text-align: right; min-width: 200px; }
        @media (max-width: 480px) {
          .report-meta { flex-direction: column; gap: 8px; align-items: stretch; }
          .report-meta .meta-right { text-align: left; min-width: auto; }
        }
      </style>

      <div class="meta-left">
        ${leftHtml}
      </div>

      <div class="meta-right">
        <div class="time"><strong>Generated:</strong><br>${timestamp}</div>
      </div>
    </div>
  `;

  if (centerMeta) {
    return html.replace('class="report-meta"', 'class="report-meta center"');
  }
  return html;
}

function breakLongWords(s, limit = 40) {
  if (!s || typeof s !== "string") return s;
  const tokens = s.split(/(\s+)/);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (!tok || tok.length <= limit) continue;
    if (!/\s/.test(tok)) {
      let out = "";
      for (let j = 0; j < tok.length; j += limit) {
        out += tok.slice(j, j + limit);
        if (j + limit < tok.length) out += "\u200B";
      }
      tokens[i] = out;
    }
  }
  return tokens.join("");
}
function rowsToHtml(title, rows) {
  const inputRows = Array.isArray(rows) ? rows.map((r) => ({ ...r })) : [];
  let headerInfo = null;
  if (inputRows.length > 0 && inputRows[0] && inputRows[0]._is_report_header) {
    headerInfo = { ...inputRows.shift() };
    delete headerInfo._is_report_header;
  }

  const headerCols =
    inputRows && inputRows.length ? Object.keys(inputRows[0]) : [];
  const colCount = headerCols.length || 0;
  const smallTableMode = colCount > 0 && colCount <= 3;

  const pageContentWidthPx = 760;
  const minColPx = 120;
  let computedColPx =
    colCount > 0 ? Math.floor(pageContentWidthPx / colCount) : minColPx;
  if (computedColPx < minColPx) computedColPx = minColPx;
  const maxTableWidthPx = 1200;

  let tableWidthPx;
  if (smallTableMode) {
    const tightColPx = Math.max(
      80,
      Math.ceil((pageContentWidthPx - 160) / colCount),
    );
    tableWidthPx = Math.min(tightColPx * colCount, maxTableWidthPx);
  } else {
    tableWidthPx = Math.min(
      Math.max(computedColPx * Math.max(1, colCount), pageContentWidthPx),
      maxTableWidthPx,
    );
  }

  const colgroup = smallTableMode
    ? ""
    : headerCols
        .map((h, i) => {
          const widthPx = headerCols.length
            ? i === headerCols.length - 1
              ? Math.max(
                  minColPx,
                  tableWidthPx - computedColPx * (headerCols.length - 1),
                )
              : computedColPx
            : computedColPx;
          return `<col style="width:${widthPx}px; min-width:${widthPx}px; box-sizing:border-box">`;
        })
        .join("");

  const colors = {
    titleColor: "#153243",
    metaColor: "#4a5568",
    headerBg: "#2E86AB",
    headerText: "#ffffff",
    rowOddBg: "#ffffff",
    rowEvenBg: "#f7fbff",
    borderColor: "#d1d5db",
    tableText: "#111827",
  };

  const titleFontSizePx = 22;
  const thFontSizePx = 10;
  const tdFontSizePx = 10;
  const cellBorderPx = 1;
  const smallMode = colCount >= 8;
  const cellPadding = smallMode ? "2px" : "6px";
  const tableFont = "Arial, Helvetica, sans-serif";

  const thBaseParts = [
    `border:${cellBorderPx}px solid ${colors.borderColor}`,
    `padding:${cellPadding}`,
    `font-size:${thFontSizePx}px`,
    `vertical-align:middle`,
    `background:${colors.headerBg}`,
    `color:${colors.headerText}`,
    `-webkit-print-color-adjust:exact`,
    `text-align:center`,
    `font-weight:600`,
    `box-sizing:border-box`,
    `overflow:hidden`,
    `white-space:normal`,
    `word-break:break-word`,
    `overflow-wrap:anywhere`,
    `hyphens:auto`,
  ];

  const tdBaseParts = [
    `border:${cellBorderPx}px solid ${colors.borderColor}`,
    `padding:${cellPadding}`,
    `font-size:${tdFontSizePx}px`,
    `vertical-align:middle`,
    `text-align:center`,
    `word-break:break-word`,
    `overflow-wrap:anywhere`,
    `white-space:pre-wrap`,
    `hyphens:auto`,
    `color:${colors.tableText}`,
    `box-sizing:border-box`,
  ];

  const thInlineBase = thBaseParts.join("; ");
  const tdInlineBase = tdBaseParts.join("; ");

  const headerDisplayMap =
    headerInfo && headerInfo._field_display_map
      ? headerInfo._field_display_map
      : null;

  const head = headerCols
    .map((h) => {
      const label =
        headerDisplayMap && headerDisplayMap[h] ? headerDisplayMap[h] : h;
      const widthAttr = smallTableMode
        ? ""
        : ` width:${Math.round(computedColPx)}px;`;
      return `<th style="${thInlineBase}${widthAttr}">${escapeHtml(
        breakLongWords(String(label), 40),
      )}</th>`;
    })
    .join("");

  const body =
    inputRows && inputRows.length
      ? inputRows
          .map((r, rowIndex) => {
            const bg = rowIndex % 2 === 0 ? colors.rowOddBg : colors.rowEvenBg;
            const tds = headerCols
              .map((c) => {
                let cell = r[c];
                if (cell === null || typeof cell === "undefined") cell = "";
                if (typeof cell === "object" && cell !== null) {
                  cell =
                    cell.name ||
                    cell.employee_name ||
                    cell.department_name ||
                    cell.value ||
                    JSON.stringify(cell);
                }
                cell = breakLongWords(String(cell), 40);
                const widthAttr = smallTableMode
                  ? ""
                  : ` width:${Math.round(computedColPx)}px;`;
                return `<td style="${tdInlineBase}; background:${bg};${widthAttr}">${escapeHtml(
                  cell,
                )}</td>`;
              })
              .join("");
            return `<tr>${tds}</tr>`;
          })
          .join("")
      : `<tr><td colspan="${
          headerCols.length || 1
        }" style="${tdInlineBase}; text-align:center; background:${
          colors.rowOddBg
        }">No data available</td></tr>`;

  const tableInlineStyleSmall = `border:${cellBorderPx}px solid ${colors.borderColor}; border-collapse:collapse; width:auto; max-width:100%; margin:0; table-layout:auto; display:inline-table;`;
  const tableInlineStyleLarge = `border:${cellBorderPx}px solid ${colors.borderColor}; border-collapse:collapse; width:${tableWidthPx}px; max-width:100%; margin:0 auto; table-layout:fixed; display:table;`;
  const tableInlineStyle = smallTableMode
    ? tableInlineStyleSmall
    : tableInlineStyleLarge;

  const css = `
    @page { size: A4 ${
      colCount >= 6 ? "landscape" : "portrait"
    }; margin: 12mm; }
    html, body { height: 100%; margin: 0; padding: 0; }
    body { font-family: ${tableFont}; color:${
      colors.tableText
    }; margin:0; padding:0; -webkit-print-color-adjust: exact; }
    .wrap { box-sizing: border-box; width: 100%; padding: 6px; margin: 0; overflow: visible; display:block; }
    .meta { margin-bottom:8px; font-size:9px; color:${colors.metaColor}; ${
      smallTableMode ? "text-align:center;" : "text-align:left;"
    } }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr { page-break-inside: avoid; }
    th { text-transform: none; }
    td, th { box-sizing: border-box; overflow-wrap:anywhere; word-break:break-word; hyphens:auto; }
    .table-center { text-align:center; width:100%; }
    .table-center table { margin:0 auto; }
    @media (max-width: 480px) {
      .meta { font-size: 11px; }
      table { width: 100% !important; display:table !important; }
    }
  `;

  const h2Inline = `font-size:${titleFontSizePx}px; font-weight:700; margin:0 0 10px 0; text-align:center; color:${colors.titleColor}`;

  const metaHeaderHtml = generateMetaHeaderHtml(headerInfo);
  const theadHtml = `<thead><tr>${
    head || `<th style="${thInlineBase}">Data</th>`
  }</tr></thead>`;
  const colgroupHtml = colgroup ? `<colgroup>${colgroup}</colgroup>` : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>${css}</style>
  </head>
  <body>
    <div class="wrap">
      <h2 style="${h2Inline}">${escapeHtml(title)}</h2>
      ${metaHeaderHtml}
      <div class="table-center">
        <table style="${tableInlineStyle}">
          ${colgroupHtml}
          ${theadHtml}
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>
  </body>
</html>`;
}

function findLibreOfficeBinary() {
  const candidates = [];
  if (process.env.LIBREOFFICE_PATH)
    candidates.push(process.env.LIBREOFFICE_PATH);
  candidates.push("soffice", "libreoffice", "soffice.exe", "libreoffice.exe");
  // Add common Windows paths
  candidates.push("C:\\Program Files\\LibreOffice\\program\\soffice.exe");
  candidates.push("C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe");
  for (const bin of candidates) {
    if (!bin) continue;
    try {
      const res = spawnSync(bin, ["--version"], { stdio: "ignore" });
      if (res && typeof res.status === "number" && res.status === 0) {
        return bin;
      }
    } catch (e) {}
  }
  try {
    const which = spawnSync("which", ["soffice"], { encoding: "utf8" });
    if (which && which.status === 0 && which.stdout) {
      const p = which.stdout.trim().split("\n")[0];
      if (p) return p;
    }
  } catch (e) {}
  return null;
}

async function renderHtmlStringToPdfBuffer(htmlString) {
  if (!htmlString || htmlString.length === 0) {
    throw new Error("Empty HTML passed to HTML->PDF converter");
  }

  // Try LibreOffice conversion first
  try {
    const tmpBase = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "report-html-"),
    );
    const htmlFilename = `report_${Date.now()}.html`;
    const htmlPath = path.join(tmpBase, htmlFilename);
    try {
      await fs.promises.writeFile(htmlPath, htmlString, "utf8");
    } catch (writeErr) {
      try {
        await fs.promises.rm(tmpBase, { recursive: true, force: true });
      } catch (e) {}
      throw writeErr;
    }
    const soffice = findLibreOfficeBinary();
    if (!soffice) {
      throw new Error(
        "LibreOffice binary not found. Install LibreOffice and ensure 'soffice' in PATH or set LIBREOFFICE_PATH.",
      );
    }
    const args = [
      "--headless",
      "--convert-to",
      "pdf",
      htmlPath,
      "--outdir",
      tmpBase,
    ];
    const timeoutMs = 30000;
    try {
      await execFile(soffice, args, {
        timeout: timeoutMs,
        maxBuffer: 50 * 1024 * 1024,
      });
    } catch (convErr) {
      try {
        const debugFiles = await fs.promises.readdir(tmpBase);
        console.error(
          "[reportRenders] LibreOffice conversion error, tmp files:",
          debugFiles,
        );
      } catch (e) {}
      try {
        await fs.promises.rm(tmpBase, { recursive: true, force: true });
      } catch (e) {}
      throw new Error(
        "LibreOffice conversion failed: " +
          (convErr && convErr.message ? convErr.message : String(convErr)),
      );
    }
    const pdfPath = path.join(
      tmpBase,
      path.basename(htmlPath, path.extname(htmlPath)) + ".pdf",
    );
    const maxWait = 5000;
    const step = 200;
    let waited = 0;
    while (waited < maxWait && !fs.existsSync(pdfPath)) {
      await new Promise((r) => setTimeout(r, step));
      waited += step;
    }
    let pdfBuf;
    try {
      pdfBuf = await fs.promises.readFile(pdfPath);
    } catch (readErr) {
      try {
        await fs.promises.rm(tmpBase, { recursive: true, force: true });
      } catch (e) {}
      throw new Error(
        "Converted PDF missing or unreadable: " +
          (readErr && readErr.message ? readErr.message : String(readErr)),
      );
    }
    try {
      await fs.promises.rm(tmpBase, { recursive: true, force: true });
    } catch (e) {
      console.warn(
        "[reportRenders] failed to cleanup tmp dir:",
        e && e.message,
      );
    }
    if (!Buffer.isBuffer(pdfBuf) || pdfBuf.length === 0) {
      throw new Error("Converted PDF is empty");
    }
    return pdfBuf;
  } catch (libreOfficeError) {
    console.warn(
      "[reportRenders] LibreOffice conversion failed, falling back to PDFKit:",
      libreOfficeError.message,
    );

    // Fallback: Create a basic PDF using PDFKit with HTML content as plain text
    return new Promise((resolve, reject) => {
      try {
        const chunks = [];
        const doc = new PDFDocument({ size: "A4", margin: 50 });

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => {
          const pdfBuffer = Buffer.concat(chunks);
          resolve(pdfBuffer);
        });
        doc.on("error", (err) => reject(err));

        // Extract title from HTML
        const titleMatch = htmlString.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1] : "Report";

        // Extract basic text content from HTML (simple extraction)
        const textContent = htmlString
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        // Add title
        doc
          .fontSize(18)
          .font("Helvetica-Bold")
          .text(title, { align: "center" });
        doc.moveDown(2);

        // Add content
        doc.fontSize(10).font("Helvetica").text(textContent, {
          align: "left",
          lineGap: 2,
        });

        doc.end();
      } catch (fallbackError) {
        reject(
          new Error(
            `Both LibreOffice and PDFKit fallback failed: ${fallbackError.message}`,
          ),
        );
      }
    });
  }
}

async function renderXlsxBufferToPdfBuffer(xlsxBuffer, title, meta) {
  const tmpBase = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "report-xlsx-"),
  );
  const xlsxFilename = `report_${Date.now()}.xlsx`;
  const xlsxPath = path.join(tmpBase, xlsxFilename);
  try {
    await fs.promises.writeFile(xlsxPath, xlsxBuffer);
  } catch (writeErr) {
    try {
      await fs.promises.rm(tmpBase, { recursive: true, force: true });
    } catch (e) {}
    throw writeErr;
  }

  // Try LibreOffice conversion first
  try {
    const soffice = findLibreOfficeBinary();
    if (!soffice) {
      throw new Error(
        "LibreOffice/soffice not found. Install LibreOffice and ensure 'soffice' in PATH or set LIBREOFFICE_PATH.",
      );
    }
    const args = [
      "--headless",
      "--convert-to",
      "pdf:writer_pdf_Export",
      xlsxPath,
      "--outdir",
      tmpBase,
    ];
    const timeoutMs = 30000;
    try {
      await execFile(soffice, args, {
        timeout: timeoutMs,
        maxBuffer: 50 * 1024 * 1024,
      });
    } catch (convErr) {
      try {
        const debugFiles = await fs.promises.readdir(tmpBase);
        console.error(
          "[reportRenders] LibreOffice conversion error, tmp files:",
          debugFiles,
        );
      } catch (e) {}
      try {
        await fs.promises.rm(tmpBase, { recursive: true, force: true });
      } catch (e) {}
      throw new Error(
        "LibreOffice conversion failed: " +
          (convErr && convErr.message ? convErr.message : String(convErr)),
      );
    }
    const pdfPath = path.join(
      tmpBase,
      path.basename(xlsxPath, path.extname(xlsxPath)) + ".pdf",
    );
    const maxWait = 5000;
    const step = 200;
    let waited = 0;
    while (waited < maxWait && !fs.existsSync(pdfPath)) {
      await new Promise((r) => setTimeout(r, step));
      waited += step;
    }
    let pdfBuf;
    try {
      pdfBuf = await fs.promises.readFile(pdfPath);
    } catch (readErr) {
      try {
        await fs.promises.rm(tmpBase, { recursive: true, force: true });
      } catch (e) {}
      throw new Error(
        "Converted PDF missing or unreadable: " +
          (readErr && readErr.message ? readErr.message : String(readErr)),
      );
    }
    try {
      await fs.promises.rm(tmpBase, { recursive: true, force: true });
    } catch (e) {
      console.warn(
        "[reportRenders] failed to cleanup tmp dir:",
        e && e.message,
      );
    }
    if (!Buffer.isBuffer(pdfBuf) || pdfBuf.length === 0) {
      throw new Error("Converted PDF is empty");
    }

    if (!meta || Object.keys(meta).length === 0) {
      return pdfBuf;
    }

    try {
      const headerRow = [{ _is_report_header: true, ...meta }];
      const coverHtml = rowsToHtml(title || "Report", headerRow);
      const coverPdf = await renderHtmlStringToPdfBuffer(coverHtml);
      const merged = await mergePdfBuffers([coverPdf, pdfBuf]);
      return merged;
    } catch (e) {
      console.error(
        "[reportRenders] failed to attach meta cover page:",
        e && e.message,
      );
      return pdfBuf;
    }
  } catch (libreOfficeError) {
    console.warn(
      "[reportRenders] LibreOffice XLSX conversion failed, falling back to basic PDF:",
      libreOfficeError.message,
    );

    // Fallback: Create a basic PDF indicating the conversion failed
    return new Promise((resolve, reject) => {
      try {
        const chunks = [];
        const doc = new PDFDocument({ size: "A4", margin: 50 });

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => {
          const pdfBuffer = Buffer.concat(chunks);
          resolve(pdfBuffer);
        });
        doc.on("error", (err) => reject(err));

        // Add title
        doc
          .fontSize(18)
          .font("Helvetica-Bold")
          .text(title || "Excel Report", { align: "center" });
        doc.moveDown(2);

        // Add error message
        doc
          .fontSize(12)
          .font("Helvetica")
          .text("Excel to PDF conversion failed.", {
            align: "center",
          });
        doc.moveDown();
        doc
          .fontSize(10)
          .text("LibreOffice is not available in this environment.", {
            align: "center",
          });
        doc.moveDown();
        doc.text("Please ensure LibreOffice is installed and accessible.", {
          align: "center",
        });

        doc.end();
      } catch (fallbackError) {
        reject(
          new Error(`XLSX to PDF conversion failed: ${fallbackError.message}`),
        );
      }
    });
  }
}

async function mergePdfBuffers(buffers) {
  if (!buffers || !Array.isArray(buffers) || buffers.length === 0)
    return Buffer.from([]);
  const mergedPdf = await PDFLib.PDFDocument.create();
  for (const b of buffers) {
    try {
      const src = await PDFLib.PDFDocument.load(b);
      const copied = await mergedPdf.copyPages(src, src.getPageIndices());
      copied.forEach((p) => mergedPdf.addPage(p));
    } catch (e) {
      console.warn(
        "[reportRenders] skipping invalid PDF while merging:",
        e && e.message,
      );
    }
  }
  const mergedBytes = await mergedPdf.save();
  return Buffer.from(mergedBytes);
}

async function renderPdfBuffer(title, rows, meta) {
  console.log(
    `[reportRenders] renderPdfBuffer called with title: "${title}", rows: ${Array.isArray(rows) ? rows.length : "N/A"}`,
  );
  const rowsCopy = Array.isArray(rows) ? rows.map((r) => ({ ...r })) : [];
  if (meta && Object.keys(meta).length > 0) {
    rowsCopy.unshift({ _is_report_header: true, ...meta });
  }
  const html = rowsToHtml(title || "Report", rowsCopy);
  if (!html || html.length === 0) {
    throw new Error("Empty HTML passed to PDF generator");
  }
  console.log(`[reportRenders] Generated HTML: ${html.length} characters`);
  const pdfBuf = await renderHtmlStringToPdfBuffer(html);
  console.log(`[reportRenders] Generated PDF: ${pdfBuf.length} bytes`);
  return pdfBuf;
}

async function renderExcelToPdfBuffer(rows, headers, title, meta) {
  const xlsxBuffer = await renderExcelBuffer(rows, headers);
  const pdfBuf = await renderXlsxBufferToPdfBuffer(xlsxBuffer, title, meta);
  return pdfBuf;
}

function createPdfFromPng(pngPath) {
  return new Promise((resolve, reject) => {
    try {
      const tmpOut = pngPath.replace(/\.png$/i, `.fallback.pdf`);
      const stream = fs.createWriteStream(tmpOut);
      stream.on("error", (err) => reject(err));
      stream.on("finish", () => {
        try {
          const pdfBuf = fs.readFileSync(tmpOut);
          try {
            fs.unlinkSync(tmpOut);
          } catch (e) {}
          resolve(pdfBuf);
        } catch (e) {
          reject(e);
        }
      });
      const doc = new PDFDocument({ size: "A4", margin: 20 });
      doc.pipe(stream);
      const imgBuffer = fs.readFileSync(pngPath);
      const pageWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const pageHeight =
        doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
      doc.image(imgBuffer, {
        fit: [pageWidth, pageHeight],
        align: "center",
        valign: "center",
      });
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function renderTasksPdfBufferUsingHtml(tasksRows, weeklyRows, meta) {
  const tasksRowsCopy = Array.isArray(tasksRows)
    ? tasksRows.map((r) => ({ ...r }))
    : [];
  const weeklyRowsCopy = Array.isArray(weeklyRows)
    ? weeklyRows.map((r) => ({ ...r }))
    : [];
  if (meta && Object.keys(meta).length > 0) {
    tasksRowsCopy.unshift({ _is_report_header: true, ...meta });
    weeklyRowsCopy.unshift({ _is_report_header: true, ...meta });
  }
  const tasksHtml = rowsToHtml("Tasks", tasksRowsCopy);
  const weeklyHtml = rowsToHtml("Weekly Tasks", weeklyRowsCopy);
  const tasksPdf = await renderHtmlStringToPdfBuffer(tasksHtml);
  const weeklyPdf = await renderHtmlStringToPdfBuffer(weeklyHtml);
  return Buffer.concat([tasksPdf, weeklyPdf]);
}

async function renderTasksPdfBufferFromXlsx(tasksRows, weeklyRows) {
  const xlsxBuffer = await renderTasksExcelBuffer(tasksRows, weeklyRows);
  const pdfBuf = await renderXlsxBufferToPdfBuffer(xlsxBuffer);
  return pdfBuf;
}

async function renderTasksPdfBuffer(tasksRows, weeklyRows) {
  return await renderTasksPdfBufferUsingHtml(tasksRows, weeklyRows);
}

module.exports = {
  renderExcelBuffer,
  renderTasksExcelBuffer,
  renderPdfBuffer,
  renderExcelToPdfBuffer,
  renderHtmlStringToPdfBuffer,
  renderXlsxBufferToPdfBuffer,
  renderTasksPdfBuffer,
  renderTasksPdfBufferUsingHtml,
  renderTasksPdfBufferFromXlsx,
  createPdfFromPng,
  findLibreOfficeBinary,
};
