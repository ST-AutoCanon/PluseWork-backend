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

const { escapeHtml } = require("./reportMeta");

function pruneEmptyColumnsFromData(rows, columns) {
  if (!Array.isArray(columns) || columns.length === 0) {
    return { columns: [], keptIndexes: [] };
  }

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
  return await workbook.xlsx.writeBuffer();
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
    const usedRowsForCols = safeRows.length > 0 ? safeRows : fallbackSafe;

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

  return await workbook.xlsx.writeBuffer();
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
      return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")} ${timePart} (Asia/Kolkata)`;
    }

    return `${s} (Asia/Kolkata)`;
  } catch (e) {
    const iso = new Date().toISOString().slice(0, 19).replace("T", " ");
    return `${iso} (UTC)`;
  }
}

function normalizeCellValue(cell) {
  if (cell === null || typeof cell === "undefined") return "";
  if (typeof cell === "object") {
    return (
      cell.name ||
      cell.employee_name ||
      cell.department_name ||
      cell.value ||
      JSON.stringify(cell)
    );
  }
  return String(cell);
}

function prettyLabel(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function splitRowsAndHeaderMeta(rows, meta) {
  const rowsCopy = Array.isArray(rows) ? rows.map((r) => ({ ...r })) : [];
  let headerMeta = {};

  if (rowsCopy.length > 0 && rowsCopy[0] && rowsCopy[0]._is_report_header) {
    headerMeta = { ...rowsCopy.shift() };
    delete headerMeta._is_report_header;
  }

  const mergedMeta = {
    ...(meta && typeof meta === "object" ? meta : {}),
    ...headerMeta,
  };

  delete mergedMeta._is_report_header;
  return { rowsCopy, mergedMeta };
}

function cleanMetaForDisplay(meta) {
  const out = [];
  if (!meta || typeof meta !== "object") return out;

  const getValue = (v) => {
    if (v === null || typeof v === "undefined") return "";
    if (typeof v === "object") {
      return (
        v.name ||
        v.status ||
        v.department_name ||
        v.departmentName ||
        v.employee_name ||
        v.full_name ||
        v.email ||
        v.id ||
        JSON.stringify(v)
      );
    }
    return String(v).trim();
  };

  const status = getValue(meta.status);
  const department = getValue(meta.department || meta.departmentName);
  const employee = getValue(
    meta.employeeName || meta.employee || meta.employee_name,
  );

  if (status) out.push({ label: "Status", value: status });
  if (department) out.push({ label: "Department", value: department });
  if (employee) out.push({ label: "Employee", value: employee });

  const alreadyUsed = new Set([
    "status",
    "department",
    "departmentName",
    "employee",
    "employeeName",
    "employee_name",
    "_is_report_header",
    "_field_display_map",
  ]);

  for (const [key, value] of Object.entries(meta)) {
    if (alreadyUsed.has(key)) continue;
    const normalized = getValue(value);
    if (!normalized) continue;
    out.push({ label: prettyLabel(key), value: normalized });
  }

  out.push({
    label: "Generated",
    value: formatTimestampAsiaKolkata(new Date()),
  });

  return out;
}

function getReportColumns(rows, displayMap = {}) {
  const seen = new Set();
  const cols = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    for (const key of Object.keys(row)) {
      if (key === "_is_report_header" || key === "_field_display_map") continue;
      if (!seen.has(key)) {
        seen.add(key);
        cols.push({
          key,
          label: displayMap && displayMap[key] ? displayMap[key] : key,
        });
      }
    }
  }

  if (cols.length === 0) {
    cols.push({ key: "message", label: "Message" });
  }

  return cols;
}

function getLayoutForColumns(columnCount) {
  return columnCount >= 6 ? "landscape" : "portrait";
}

function computeEvenWidths(totalWidth, count) {
  if (!count || count <= 0) return [];
  const base = Math.floor(totalWidth / count);
  const widths = new Array(count).fill(base);
  widths[count - 1] += totalWidth - base * count;
  return widths;
}

function measureRowHeight(
  doc,
  rowValues,
  widths,
  fontName,
  fontSize,
  paddingY,
) {
  const lineGap = 1;
  let maxHeight = 0;

  for (let i = 0; i < rowValues.length; i++) {
    const text = normalizeCellValue(rowValues[i]);
    const width = Math.max(18, widths[i] - 2 * paddingY);
    doc.font(fontName).fontSize(fontSize);
    const h = doc.heightOfString(text, {
      width,
      align: "center",
      lineGap,
    });
    if (h > maxHeight) maxHeight = h;
  }

  return Math.max(18, Math.ceil(maxHeight + paddingY * 2 + 2));
}

function drawCell(doc, x, y, width, height, text, options = {}) {
  const {
    fillColor = "#ffffff",
    borderColor = "#000000",
    textColor = "#000000",
    fontName = "Helvetica",
    fontSize = 8,
    paddingX = 4,
    paddingY = 3,
    bold = false,
  } = options;

  doc.save();
  doc.lineWidth(0.7);

  doc.fillColor(fillColor);
  doc.rect(x, y, width, height).fill();

  doc.strokeColor(borderColor);
  doc.rect(x, y, width, height).stroke();

  doc.fillColor(textColor);
  doc.font(bold ? "Helvetica-Bold" : fontName).fontSize(fontSize);
  doc.text(normalizeCellValue(text), x + paddingX, y + paddingY, {
    width: Math.max(8, width - 2 * paddingX),
    height: Math.max(8, height - 2 * paddingY),
    align: "center",
    valign: "center",
    lineGap: 1,
  });

  doc.restore();
}

function drawReportTableHeader(doc, columns, widths, x, y, options = {}) {
  const {
    headerFontSize = 8,
    headerFill = "#2E86AB",
    borderColor = "#000000",
    textColor = "#ffffff",
    paddingX = 4,
    paddingY = 3,
  } = options;

  const headerValues = columns.map((c) => c.label || c.key);
  const height = measureRowHeight(
    doc,
    headerValues,
    widths,
    "Helvetica-Bold",
    headerFontSize,
    paddingY,
  );

  let cursorX = x;
  for (let i = 0; i < columns.length; i++) {
    drawCell(doc, cursorX, y, widths[i], height, headerValues[i], {
      fillColor: headerFill,
      borderColor,
      textColor,
      fontName: "Helvetica-Bold",
      fontSize: headerFontSize,
      paddingX,
      paddingY,
      bold: true,
    });
    cursorX += widths[i];
  }

  return height;
}

function drawReportRow(
  doc,
  row,
  columns,
  widths,
  x,
  y,
  rowIndex,
  options = {},
) {
  const {
    bodyFontSize = 8,
    borderColor = "#000000",
    paddingX = 4,
    paddingY = 3,
  } = options;

  const values = columns.map((c) => row[c.key]);
  const height = measureRowHeight(
    doc,
    values,
    widths,
    "Helvetica",
    bodyFontSize,
    paddingY,
  );

  const bg = rowIndex % 2 === 0 ? "#ffffff" : "#f7fbff";

  let cursorX = x;
  for (let i = 0; i < columns.length; i++) {
    drawCell(doc, cursorX, y, widths[i], height, values[i], {
      fillColor: bg,
      borderColor,
      textColor: "#000000",
      fontName: "Helvetica",
      fontSize: bodyFontSize,
      paddingX,
      paddingY,
      bold: false,
    });
    cursorX += widths[i];
  }

  return height;
}

async function renderReportTablePdfBuffer(title, rows, meta = {}) {
  const { rowsCopy, mergedMeta } = splitRowsAndHeaderMeta(rows, meta);
  const displayMap =
    mergedMeta && mergedMeta._field_display_map
      ? mergedMeta._field_display_map
      : {};

  let safeRows = Array.isArray(rowsCopy) ? rowsCopy.map((r) => ({ ...r })) : [];
  let columns = getReportColumns(safeRows, displayMap);

  if (safeRows.length === 0) {
    safeRows = [{ message: "No data available for selected report." }];
    columns = [{ key: "message", label: "Message" }];
  }

  const layout = getLayoutForColumns(columns.length);

  return await new Promise((resolve, reject) => {
    try {
      const chunks = [];
      const doc = new PDFDocument({
        size: "A4",
        layout,
        margin: 18,
        autoFirstPage: true,
      });

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      const pageMargins = doc.page.margins;
      const tableWidth = doc.page.width - pageMargins.left - pageMargins.right;

      const widths = computeEvenWidths(tableWidth, columns.length);
      const titleFontSize = columns.length >= 10 ? 16 : 18;
      const bodyFontSize = columns.length >= 10 ? 7.2 : 8.4;
      const headerFontSize = columns.length >= 10 ? 7.6 : 8.6;
      const paddingX = columns.length >= 10 ? 3 : 4;
      const paddingY = columns.length >= 10 ? 2 : 3;

      let cursorY = pageMargins.top;

      const safeTitle = title || "Report";
      doc.font("Helvetica-Bold").fontSize(titleFontSize).fillColor("#153243");
      doc.text(safeTitle, pageMargins.left, cursorY, {
        width: tableWidth,
        align: "center",
      });

      cursorY = doc.y + 6;

      const metaLines = cleanMetaForDisplay(mergedMeta);
      if (metaLines.length > 0) {
        doc.font("Helvetica").fontSize(10).fillColor("#000000");
        for (const item of metaLines) {
          const line = `${item.label}: ${item.value}`;
          doc.text(line, pageMargins.left, cursorY, {
            width: tableWidth,
            align: "left",
          });
          cursorY = doc.y + 2;
        }
        cursorY += 4;
      } else {
        cursorY += 2;
      }

      const bottomLimit = doc.page.height - pageMargins.bottom;

      if (cursorY + 20 > bottomLimit) {
        doc.addPage();
        cursorY = pageMargins.top;
      }

      const headerHeight = drawReportTableHeader(
        doc,
        columns,
        widths,
        pageMargins.left,
        cursorY,
        {
          headerFontSize,
          headerFill: "#2E86AB",
          borderColor: "#000000",
          textColor: "#ffffff",
          paddingX,
          paddingY,
        },
      );

      cursorY += headerHeight;

      if (safeRows.length === 0) {
        doc.end();
        return;
      }

      for (let i = 0; i < safeRows.length; i++) {
        const row = safeRows[i];
        const rowHeight = measureRowHeight(
          doc,
          columns.map((c) => row[c.key]),
          widths,
          "Helvetica",
          bodyFontSize,
          paddingY,
        );

        if (cursorY + rowHeight > bottomLimit) {
          doc.addPage();
          cursorY = pageMargins.top;

          const repeatHeaderHeight = drawReportTableHeader(
            doc,
            columns,
            widths,
            pageMargins.left,
            cursorY,
            {
              headerFontSize,
              headerFill: "#2E86AB",
              borderColor: "#000000",
              textColor: "#ffffff",
              paddingX,
              paddingY,
            },
          );
          cursorY += repeatHeaderHeight;
        }

        const drawnHeight = drawReportRow(
          doc,
          row,
          columns,
          widths,
          pageMargins.left,
          cursorY,
          i,
          {
            bodyFontSize,
            borderColor: "#000000",
            paddingX,
            paddingY,
          },
        );
        cursorY += drawnHeight;
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function findLibreOfficeBinary() {
  const candidates = [];
  if (process.env.LIBREOFFICE_PATH) {
    candidates.push(process.env.LIBREOFFICE_PATH);
  }

  candidates.push(
    "soffice",
    "libreoffice",
    "soffice.exe",
    "libreoffice.exe",
    "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
    "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
  );

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
        "LibreOffice binary not found. Install LibreOffice and ensure 'soffice' is in PATH or set LIBREOFFICE_PATH.",
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

    await execFile(soffice, args, {
      timeout: 30000,
      maxBuffer: 50 * 1024 * 1024,
    });

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
    } catch (e) {}

    if (!Buffer.isBuffer(pdfBuf) || pdfBuf.length === 0) {
      throw new Error("Converted PDF is empty");
    }

    return pdfBuf;
  } catch (libreOfficeError) {
    return new Promise((resolve, reject) => {
      try {
        const chunks = [];
        const doc = new PDFDocument({ size: "A4", margin: 50 });

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", (err) => reject(err));

        const titleMatch = htmlString.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? escapeHtml(titleMatch[1]) : "Report";

        const textContent = htmlString
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        doc
          .fontSize(18)
          .font("Helvetica-Bold")
          .text(title, { align: "center" });
        doc.moveDown(2);

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

async function renderMetaCoverPdfBuffer(title, meta) {
  const lines = cleanMetaForDisplay(meta);

  return await new Promise((resolve, reject) => {
    try {
      const chunks = [];
      const doc = new PDFDocument({
        size: "A4",
        layout: "portrait",
        margin: 40,
        autoFirstPage: true,
      });

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      const pageWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;

      doc
        .font("Helvetica-Bold")
        .fontSize(18)
        .fillColor("#153243")
        .text(title || "Report", doc.page.margins.left, 60, {
          width: pageWidth,
          align: "center",
        });

      let y = doc.y + 18;
      doc.font("Helvetica").fontSize(11).fillColor("#000000");

      for (const item of lines) {
        const text = `${item.label}: ${item.value}`;
        doc.text(text, doc.page.margins.left, y, {
          width: pageWidth,
          align: "left",
        });
        y = doc.y + 6;
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
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

  try {
    const soffice = findLibreOfficeBinary();
    if (!soffice) {
      throw new Error(
        "LibreOffice/soffice not found. Install LibreOffice and ensure 'soffice' is in PATH or set LIBREOFFICE_PATH.",
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

    await execFile(soffice, args, {
      timeout: 30000,
      maxBuffer: 50 * 1024 * 1024,
    });

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
    } catch (e) {}

    if (!Buffer.isBuffer(pdfBuf) || pdfBuf.length === 0) {
      throw new Error("Converted PDF is empty");
    }

    const hasMeta =
      meta &&
      Object.keys(meta).some(
        (k) =>
          k !== "_field_display_map" &&
          meta[k] !== null &&
          meta[k] !== undefined &&
          String(meta[k]).trim() !== "",
      );

    if (!hasMeta) {
      return pdfBuf;
    }

    try {
      const coverPdf = await renderMetaCoverPdfBuffer(title || "Report", meta);
      return await mergePdfBuffers([coverPdf, pdfBuf]);
    } catch (e) {
      console.error(
        "[reportRenders] failed to attach meta cover page:",
        e && e.message,
      );
      return pdfBuf;
    }
  } catch (libreOfficeError) {
    return new Promise((resolve, reject) => {
      try {
        const chunks = [];
        const doc = new PDFDocument({ size: "A4", margin: 50 });

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", (err) => reject(err));

        doc
          .fontSize(18)
          .font("Helvetica-Bold")
          .text(title || "Excel Report", { align: "center" });
        doc.moveDown(2);

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
  if (!buffers || !Array.isArray(buffers) || buffers.length === 0) {
    return Buffer.from([]);
  }

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

  const pdfBuf = await renderReportTablePdfBuffer(
    title || "Report",
    rows,
    meta,
  );
  console.log(`[reportRenders] Generated PDF: ${pdfBuf.length} bytes`);
  return pdfBuf;
}

async function renderExcelToPdfBuffer(rows, headers, title, meta) {
  const xlsxBuffer = await renderExcelBuffer(rows, headers);
  return await renderXlsxBufferToPdfBuffer(xlsxBuffer, title, meta);
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
  const tasksPdf = await renderReportTablePdfBuffer("Tasks", tasksRows, meta);
  const weeklyPdf = await renderReportTablePdfBuffer(
    "Weekly Tasks",
    weeklyRows,
    meta,
  );
  return await mergePdfBuffers([tasksPdf, weeklyPdf]);
}

async function renderTasksPdfBufferFromXlsx(tasksRows, weeklyRows) {
  const xlsxBuffer = await renderTasksExcelBuffer(tasksRows, weeklyRows);
  return await renderXlsxBufferToPdfBuffer(xlsxBuffer);
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
  mergePdfBuffers,
  findLibreOfficeBinary,
};
