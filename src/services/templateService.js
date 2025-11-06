const fs = require("fs-extra");
const path = require("path");
const sharp = require("sharp");
const { promisify } = require("util");
const { execFile } = require("child_process");
const execFileP = promisify(execFile);
const { v4: uuidv4 } = require("uuid");
const db = require("../config");
const {
  INSERT_TEMPLATE,
  INSERT_TEMPLATE_VERSION,
  GET_TEMPLATES_BY_ORG,
} = require("../constants/templateQueries");

async function runTesseractCLI(imagePath) {
  try {
    const { stdout } = await execFileP("tesseract", [
      imagePath,
      "stdout",
      "-l",
      "eng",
      "tsv",
    ]);
    if (!stdout) return { text: "", words: [] };

    const lines = stdout.split(/\r?\n/).filter(Boolean);
    if (lines.length <= 1) return { text: "", words: [] };

    const headerCols = lines[0].split("\t").map((h) => h.trim());
    const idx = (name) => headerCols.indexOf(name);
    const leftI = idx("left");
    const topI = idx("top");
    const widthI = idx("width");
    const heightI = idx("height");
    const confI = idx("conf");
    const textI = idx("text");

    const words = [];
    const allText = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split("\t");
      const text = (cols[textI] || "").trim();
      if (!text) continue;
      const left = Number(cols[leftI] || 0);
      const top = Number(cols[topI] || 0);
      const width = Number(cols[widthI] || 0);
      const height = Number(cols[heightI] || 0);
      const conf = cols[confI] ? Number(cols[confI]) : null;
      words.push({
        text,
        bbox: { x0: left, y0: top, x1: left + width, y1: top + height },
        conf,
      });
      allText.push(text);
    }

    return { text: allText.join("\n"), words };
  } catch (err) {
    console.warn(
      "Tesseract CLI failed:",
      err && err.message ? err.message : err
    );
    return { text: "", words: [] };
  }
}

function groupWordsIntoLines(words = [], yThreshold = 10) {
  if (!Array.isArray(words) || words.length === 0) return [];

  const cleaned = words
    .map((w) => {
      const text = (w.text || "").toString();
      const bbox = w.bbox || null;
      return { text, bbox };
    })
    .filter((w) => (w.text && w.text.trim()) || w.bbox);

  if (!cleaned.length) return [];

  const lines = [];
  cleaned.forEach((w) => {
    const bbox = w.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
    const centerY = (bbox.y0 + bbox.y1) / 2;
    let line = lines.find((l) => Math.abs(l.y - centerY) < yThreshold);
    if (!line) {
      line = { y: centerY, words: [] };
      lines.push(line);
    }
    line.words.push({ text: w.text, bbox });
  });

  lines.forEach(
    (l) =>
      (l.words = l.words.sort((a, b) => (a.bbox.x0 || 0) - (b.bbox.x0 || 0)))
  );
  lines.sort((a, b) => a.y - b.y);
  return lines;
}

function buildGrapesFromComposite(
  compositeUrl,
  compositeMeta = {},
  lines = []
) {
  const W = compositeMeta.width || 1000;
  const H = compositeMeta.height || 1400;

  const overlayComponents = (lines || []).map((line, idx) => {
    const words = line.words || [];
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    words.forEach((w) => {
      const b = w.bbox || {};
      x0 = Math.min(x0, b.x0 || x0);
      y0 = Math.min(y0, b.y0 || y0);
      x1 = Math.max(x1, b.x1 || x1);
      y1 = Math.max(y1, b.y1 || y1);
    });
    if (!isFinite(x0)) x0 = 0;
    if (!isFinite(y0)) y0 = 0;
    if (!isFinite(x1)) x1 = W;
    if (!isFinite(y1)) y1 = y0 + 16;

    const leftPct = (x0 / W) * 100;
    const topPct = (y0 / H) * 100;
    const widthPct = ((x1 - x0) / W) * 100;
    const heightPx = Math.max(14, y1 - y0 || 16);
    const fontSize = Math.max(10, Math.round(heightPx * 0.7));

    const text = words.map((w) => w.text).join(" ") || "\u00A0";
    return {
      type: "text",
      content: text,
      attributes: { "data-field": `ocr_line_${idx + 1}`, "data-ocr-conf": "" },
      draggable: true,
      selectable: true,
      style: {
        position: "absolute",
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: `${widthPct}%`,
        minHeight: `${heightPx}px`,
        padding: "2px",
        background: "transparent",
        overflow: "hidden",
        whiteSpace: "pre-wrap",
        fontSize: `${fontSize}px`,
        cursor: "text",
        border: "0px dashed rgba(0,0,0,0.12)",
      },
    };
  });

  const overlaysFinal = overlayComponents.length
    ? overlayComponents
    : [
        {
          type: "text",
          content: "[PLACEHOLDER]",
          draggable: true,
          selectable: true,
          attributes: { "data-field": "ocr_placeholder_1" },
          style: {
            position: "absolute",
            left: "8%",
            top: "12%",
            width: "84%",
            minHeight: "20px",
            padding: "4px",
            fontSize: "12px",
            cursor: "text",
            border: "1px dashed rgba(0,0,0,0.12)",
          },
        },
      ];

  const components = [
    {
      tagName: "div",
      attributes: { class: "template-page", "data-org-template": true },
      style: { position: "relative", width: `${W}px`, maxWidth: "100%" },
      components: [
        {
          type: "image",
          attributes: {
            src: compositeUrl,
            class: "template-bg-img",
            alt: "composite",
          },
          style: { width: "100%", display: "block", pointerEvents: "none" },
          selectable: false,
          draggable: false,
        },
        {
          tagName: "div",
          attributes: { class: "overlays" },
          style: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: "auto",
          },
          components: overlaysFinal,
        },
      ],
    },
  ];

  const grapesJson = {
    id: uuidv4(),
    components,
    styles: `
      body { font-family: Arial, sans-serif; }
      .template-bg-img { max-width: 100%; display:block; }
      .overlays { position:absolute; top:0; left:0; right:0; bottom:0; }
    `,
  };

  const htmlLines = (lines || [])
    .map((line) => {
      const words = line.words || [];
      if (!words.length) return "";
      let bx0 = Infinity,
        by0 = Infinity,
        bx1 = -Infinity,
        by1 = -Infinity;
      words.forEach((w) => {
        const b = w.bbox || {};
        bx0 = Math.min(bx0, b.x0 || bx0);
        by0 = Math.min(by0, b.y0 || by0);
        bx1 = Math.max(bx1, b.x1 || bx1);
        by1 = Math.max(by1, b.y1 || by1);
      });
      if (!isFinite(bx0)) return "";
      const left = (bx0 / W) * 100;
      const top = (by0 / H) * 100;
      const width = ((bx1 - bx0) / W) * 100;
      const text = words
        .map((w) => w.text)
        .join(" ")
        .replace(/</g, "&lt;");
      return `<div style="position:absolute;left:${left}%;top:${top}%;width:${width}%;padding:2px;font-size:12px">${text}</div>`;
    })
    .join("");

  const html = `
    <div class="template-page" style="position:relative;width:${W}px;max-width:100%;">
      <img src="${compositeUrl}" class="template-bg-img" style="width:100%;display:block;pointer-events:none;"/>
      <div class="overlays" style="position:absolute;top:0;left:0;right:0;bottom:0;">
        ${htmlLines}
      </div>
    </div>
  `;

  return { grapesJson, html };
}

async function makeCompositeAndCleanMask({
  headerPath,
  bodyPath,
  footerPath,
  uploadsDir,
  backendBase,
  orgId,
}) {
  const pieces = [];
  if (headerPath) pieces.push({ path: headerPath });
  if (bodyPath) pieces.push({ path: bodyPath });
  if (footerPath) pieces.push({ path: footerPath });

  const buffersMeta = [];
  for (const p of pieces) {
    const buf = await fs.readFile(p.path);
    const meta = await sharp(buf).metadata();
    buffersMeta.push({ buf, meta });
  }

  const compW = Math.max(...buffersMeta.map((b) => b.meta.width || 1000));
  const resizedBuffers = await Promise.all(
    buffersMeta.map(async ({ buf, meta }) => {
      if (!meta.width || meta.width === compW) return { buf, meta };
      const resizedBuf = await sharp(buf).resize({ width: compW }).toBuffer();
      const newMeta = await sharp(resizedBuf).metadata();
      return { buf: resizedBuf, meta: newMeta };
    })
  );

  const totalHeight = resizedBuffers.reduce(
    (s, p) => s + (p.meta.height || 0),
    0
  );
  const compositeImage = sharp({
    create: {
      width: compW,
      height: totalHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  });

  const composites = [];
  let top = 0;
  for (const p of resizedBuffers) {
    composites.push({ input: p.buf, top, left: 0 });
    top += p.meta.height || 0;
  }

  const compositeBuffer = await compositeImage
    .composite(composites)
    .png()
    .toBuffer();
  const compositeMeta = await sharp(compositeBuffer).metadata();

  const name = `${Date.now()}_composite.png`;
  const compositePath = path.join(uploadsDir, name);
  await fs.writeFile(compositePath, compositeBuffer);
  const compositeUrl = `${backendBase}/api/orgs/${orgId}/uploads/${name}`;

  return { compositePath, compositeUrl, compositeMeta, resizedBuffers };
}

async function makeCleanedComposite({
  compositePath,
  words = [],
  compositeMeta = {},
  uploadsDir,
  backendBase,
  orgId,
}) {
  const W = compositeMeta.width;
  const H = compositeMeta.height;
  if (!W || !H) {
    const name = `${Date.now()}_composite_clean.png`;
    const dest = path.join(uploadsDir, name);
    await fs.copy(compositePath, dest);
    return {
      cleanedPath: dest,
      cleanedUrl: `${backendBase}/api/orgs/${orgId}/uploads/${name}`,
      cleanedMeta: compositeMeta,
    };
  }

  const rectsSvg = (words || [])
    .map((w) => {
      if (!w || !w.bbox) return "";
      const b = w.bbox;
      const pad = 2; // px
      const x = Math.max(0, (b.x0 || 0) - pad);
      const y = Math.max(0, (b.y0 || 0) - pad);
      const width = Math.min(W - x, Math.max(1, b.x1 - b.x0 + pad * 2));
      const height = Math.min(H - y, Math.max(1, b.y1 - b.y0 + pad * 2));
      return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="white" rx="0" ry="0" />`;
    })
    .join("\n");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <rect x="0" y="0" width="${W}" height="${H}" fill="transparent"/>
      ${rectsSvg}
    </svg>
  `;
  const svgBuffer = Buffer.from(svg);

  const cleanedBuffer = await sharp(compositePath)
    .composite([{ input: svgBuffer, blend: "over" }])
    .png()
    .toBuffer();
  const cleanedMeta = await sharp(cleanedBuffer).metadata();
  const name = `${Date.now()}_composite_clean.png`;
  const cleanedPath = path.join(uploadsDir, name);
  await fs.writeFile(cleanedPath, cleanedBuffer);
  const cleanedUrl = `${backendBase}/api/orgs/${orgId}/uploads/${name}`;

  return { cleanedPath, cleanedUrl, cleanedMeta };
}

async function processScanToTemplate({
  orgId,
  userId,
  headerPath,
  headerOriginal,
  bodyPath,
  bodyOriginal,
  footerPath,
  footerOriginal,
}) {
  const publicUploads = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "public",
    "uploads"
  );
  await fs.ensureDir(publicUploads);

  async function moveToUploads(tmpPath, originalName, uploadsDir) {
    if (!tmpPath) return null;

    const destUploads =
      uploadsDir || path.join(__dirname, "..", "..", "..", "public", "uploads");
    await fs.ensureDir(destUploads);

    const destName = `${Date.now()}_${path
      .basename(originalName || tmpPath)
      .replace(/\s/g, "_")}`;
    const destPath = path.join(destUploads, destName);

    await fs.ensureDir(path.dirname(destPath));

    await fs.move(tmpPath, destPath, { overwrite: true });

    const meta = await sharp(destPath)
      .metadata()
      .catch((e) => {
        console.warn("sharp metadata failed", e);
        return {};
      });

    return { destName, destPath, meta };
  }

  const headerInfo = headerPath
    ? await moveToUploads(headerPath, headerOriginal, publicUploads)
    : null;
  const bodyInfo = bodyPath
    ? await moveToUploads(bodyPath, bodyOriginal, publicUploads)
    : null;
  const footerInfo = footerPath
    ? await moveToUploads(footerPath, footerOriginal, publicUploads)
    : null;

  const backendBase =
    process.env.BACKEND_BASE_URL ||
    `http://localhost:${process.env.PORT || 5000}`;

  const headerUrl = headerInfo
    ? `${backendBase}/api/orgs/${orgId}/uploads/${headerInfo.destName}`
    : null;
  const bodyUrl = bodyInfo
    ? `${backendBase}/api/orgs/${orgId}/uploads/${bodyInfo.destName}`
    : null;
  const footerUrl = footerInfo
    ? `${backendBase}/api/orgs/${orgId}/uploads/${footerInfo.destName}`
    : null;

  const { compositePath, compositeUrl, compositeMeta, resizedBuffers } =
    await makeCompositeAndCleanMask({
      headerPath: headerInfo?.destPath || null,
      bodyPath: bodyInfo?.destPath || null,
      footerPath: footerInfo?.destPath || null,
      uploadsDir: publicUploads,
      backendBase,
      orgId,
    });

  const preprocPath = compositePath + ".ocr.png";
  try {
    await sharp(compositePath)
      .rotate()
      .greyscale()
      .normalise()
      .toBuffer()
      .then((buf) => sharp(buf).threshold(160).toFile(preprocPath));
  } catch (err) {
    console.warn("Preprocessing failed (using original composite):", err);
    await fs.copy(compositePath, preprocPath);
  }

  const ocrRes = await runTesseractCLI(preprocPath);
  const words = ocrRes.words || [];
  const previewText = (ocrRes.text || "").slice(0, 2000);

  const lines = groupWordsIntoLines(words, 10);

  const { cleanedPath, cleanedUrl, cleanedMeta } = await makeCleanedComposite({
    compositePath,
    words,
    compositeMeta,
    uploadsDir: publicUploads,
    backendBase,
    orgId,
  });

  const { grapesJson, html } = buildGrapesFromComposite(
    cleanedUrl,
    compositeMeta,
    lines
  );

  return {
    html,
    grapesJson,
    previewText,
    imageUrl: compositeUrl,
    cleanedUrl,
    imgMeta: {
      composite: compositeMeta,
      header: headerInfo?.meta || null,
      body: bodyInfo?.meta || null,
      footer: footerInfo?.meta || null,
    },
  };
}

const saveTemplate = async (orgId, userId, payload) => {
  try {
    const name = payload.name || payload.page?.name || "Untitled";
    const template_type = payload.template_type || "generic";
    const grapes_json_obj = payload.grapes_json || payload;
    const grapes_json = grapes_json_obj
      ? JSON.stringify(grapes_json_obj)
      : null;
    const html = payload.html || null;
    const css = payload.css || null;
    const thumbnail_url = payload.thumbnail_url || null;

    const [result] = await db.query(INSERT_TEMPLATE, [
      orgId,
      name,
      template_type,
      grapes_json,
      html,
      css,
      thumbnail_url,
      1,
      userId || null,
    ]);

    const insertId = result.insertId || (result && result.insertId) || null;

    try {
      await db.query(INSERT_TEMPLATE_VERSION, [
        insertId,
        grapes_json,
        html,
        css,
        1,
        userId || null,
      ]);
    } catch (verErr) {
      console.warn("Failed to insert template version:", verErr);
    }

    return { id: insertId };
  } catch (error) {
    if (error && error.code === "ER_DUP_ENTRY") {
      throw new Error("Template already exists");
    }
    throw error;
  }
};

const getTemplates = async (orgId) => {
  try {
    const [rows] = await db.query(GET_TEMPLATES_BY_ORG, [orgId]);
    return rows;
  } catch (error) {
    throw error;
  }
};

module.exports = { processScanToTemplate, saveTemplate, getTemplates };
