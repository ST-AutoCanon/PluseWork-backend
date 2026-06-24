const { PDFDocument } = require("pdf-lib");
const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const libre = require("libreoffice-convert");
const sharp = require("sharp");
const { spawn, spawnSync } = require("child_process");

async function fileExistsNonEmpty(fp) {
  try {
    const st = await fsp.stat(fp);
    return st && st.size && st.size > 0;
  } catch (e) {
    return false;
  }
}

function isSofficeAvailable() {
  try {
    const res = spawnSync("soffice", ["--version"], { encoding: "utf8" });
    return res && (res.status === 0 || (res.stdout && res.stdout.length > 0));
  } catch (e) {
    return false;
  }
}

function convertWithSoffice(docxPath, outDir) {
  return new Promise((resolve, reject) => {
    const args = [
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      outDir,
      docxPath,
    ];
    const child = spawn("soffice", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => reject(err));
    child.on("exit", (code) => {
      const pdfPath = path.join(
        outDir,
        path.basename(docxPath).replace(/\.docx$/i, ".pdf"),
      );
      if (code === 0 && fs.existsSync(pdfPath)) return resolve(pdfPath);
      return reject(
        new Error(`soffice conversion failed (code=${code}) ${stderr}`),
      );
    });
  });
}

async function extractImagesFromPdf(pdfPath) {
  const images = [];
  try {
    const bytes = fs.readFileSync(pdfPath);
    const srcPdf = await PDFDocument.load(bytes);
    const context = srcPdf.context;

    for (const [ref, obj] of context.enumerateIndirectObjects()) {
      try {
        if (!obj || !obj.dict) continue;
        const subtype = obj.dict.get("Subtype");
        if (subtype && subtype.name === "Image") {
          const imageBytes = obj.contents;
          const filter = obj.dict.get("Filter");

          if (filter && filter.name === "DCTDecode") {
            images.push({ data: imageBytes, type: "jpg" });
          } else {
            const pngBuffer = await sharp(imageBytes).png().toBuffer();
            images.push({ data: pngBuffer, type: "png" });
          }
        }
      } catch (e) {
        continue;
      }
    }
  } catch (err) {
    console.warn("extractImagesFromPdf warning:", err.message);
  }
  return images;
}

async function optimizeImageBuffer(buf) {
  return sharp(buf)
    .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
    .toBuffer();
}

async function optimizeImageFromPath(imagePath) {
  return sharp(imagePath)
    .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
    .toBuffer();
}

async function resolveAttachmentFilePath(att = {}, orgId = null) {
  try {
    const candidatePaths = [];

    if (att.file_path) {
      candidatePaths.push(att.file_path);
      if (!path.isAbsolute(att.file_path) && orgId) {
        candidatePaths.push(
          path.join(
            __dirname,
            "..",
            "reimbursement",
            String(orgId),
            att.file_path,
          ),
        );
      }
      candidatePaths.push(
        path.join(__dirname, "..", "reimbursement", att.file_path),
      );
    }

    const fileName =
      att.file_name || (att.file_path ? path.basename(att.file_path) : null);

    if (fileName) {
      const m = String(fileName).match(/^(\d{4})[-_](\d{2})/);
      if (m) {
        const year = m[1];
        const month = m[2];

        if (orgId && att.employee_id) {
          candidatePaths.push(
            path.join(
              __dirname,
              "..",
              "reimbursement",
              String(orgId),
              year,
              month,
              String(att.employee_id),
              fileName,
            ),
          );
        }

        if (orgId) {
          candidatePaths.push(
            path.join(
              __dirname,
              "..",
              "reimbursement",
              String(orgId),
              year,
              month,
              fileName,
            ),
          );
        }

        candidatePaths.push(
          path.join(
            __dirname,
            "..",
            "reimbursement",
            year,
            month,
            att.employee_id ? String(att.employee_id) : "",
            fileName,
          ),
        );
      }

      if (orgId && att.employee_id) {
        candidatePaths.push(
          path.join(__dirname, "..", "reimbursement", String(orgId), fileName),
        );
        candidatePaths.push(
          path.join(
            __dirname,
            "..",
            "reimbursement",
            String(orgId),
            String(att.employee_id),
            fileName,
          ),
        );
      }

      candidatePaths.push(
        path.join(__dirname, "..", "reimbursement", fileName),
      );
    }

    const seen = new Set();
    for (const cp of candidatePaths) {
      if (!cp) continue;
      const normalized = path.resolve(String(cp));
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      try {
        await fsp.access(normalized);
        return normalized;
      } catch {}
    }
  } catch (e) {}

  return null;
}

async function mergeAttachments(pdfPath, attachments = [], orgId = null) {
  const pdfBuffer = await fsp.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBuffer);

  for (const att of attachments) {
    try {
      const resolved = await resolveAttachmentFilePath(att, orgId);
      if (!resolved) {
        console.warn("Skipping invalid attachment (not found):", att);
        continue;
      }

      const ext = (resolved || "").toLowerCase().split(".").pop();

      if (ext === "pdf") {
        try {
          const otherPdfBytes = await fsp.readFile(resolved);
          const otherPdf = await PDFDocument.load(otherPdfBytes);
          const total = otherPdf.getPageCount();
          const pages = await pdfDoc.copyPages(
            otherPdf,
            Array.from({ length: total }, (_, i) => i),
          );
          pages.forEach((page) => pdfDoc.addPage(page));

          const imgs = await extractImagesFromPdf(resolved);
          for (const im of imgs) {
            try {
              const buf = await optimizeImageBuffer(im.data);
              const embedded =
                im.type === "png"
                  ? await pdfDoc.embedPng(buf)
                  : await pdfDoc.embedJpg(buf);

              const page = pdfDoc.addPage();
              const { width: pw, height: ph } = page.getSize();
              const { width: iw, height: ih } = embedded.scale(1);
              const maxW = pw - 100;
              const maxH = ph - 100;
              const ratio = Math.min(maxW / iw, maxH / ih, 1);
              const drawW = iw * ratio;
              const drawH = ih * ratio;

              page.drawImage(embedded, {
                x: (pw - drawW) / 2,
                y: (ph - drawH) / 2,
                width: drawW,
                height: drawH,
              });
            } catch (e) {
              continue;
            }
          }
        } catch (err) {
          console.error(
            "Failed to import PDF pages:",
            resolved,
            err.message || err,
          );
        }
      } else if (["png", "jpg", "jpeg"].includes(ext)) {
        try {
          const buf = await optimizeImageFromPath(resolved);
          const embedded =
            ext === "png"
              ? await pdfDoc.embedPng(buf)
              : await pdfDoc.embedJpg(buf);

          const page = pdfDoc.addPage();
          const { width: pw, height: ph } = page.getSize();
          const { width: iw, height: ih } = embedded.scale(1);
          const maxW = pw - 100;
          const maxH = ph - 100;
          const ratio = Math.min(maxW / iw, maxH / ih, 1);
          const drawW = iw * ratio;
          const drawH = ih * ratio;

          page.drawImage(embedded, {
            x: (pw - drawW) / 2,
            y: (ph - drawH) / 2,
            width: drawW,
            height: drawH,
          });
        } catch (err) {
          console.error(
            "Failed to optimize/embed image:",
            resolved,
            err.message || err,
          );
          continue;
        }
      } else {
        console.warn("Unsupported attachment type, skipping:", resolved);
      }
    } catch (outerErr) {
      console.warn(
        "Error processing attachment (skipping):",
        att,
        outerErr.message || outerErr,
      );
      continue;
    }
  }

  const finalPdfPath = pdfPath.replace(/\.pdf$/i, "_final.pdf");
  const finalBytes = await pdfDoc.save();
  await fsp.writeFile(finalPdfPath, finalBytes);
  return finalPdfPath;
}

exports.convertDocxToPdf = async (
  docxPath,
  claim = {},
  attachments = [],
  orgId = "unknown",
) => {
  if (!docxPath) throw new Error("docxPath required");
  const absDocx = path.resolve(docxPath);
  const outDir = path.dirname(absDocx);

  if (!(await fileExistsNonEmpty(absDocx))) {
    throw new Error(`DOCX file missing or empty: ${absDocx}`);
  }

  const pdfPath = absDocx.replace(/\.docx$/i, ".pdf");
  let convertedPdfPath = null;

  try {
    const docxBuffer = await fsp.readFile(absDocx);
    if (!docxBuffer || docxBuffer.length === 0) {
      throw new Error("DOCX buffer empty");
    }

    const pdfBuffer = await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("libre.convert timeout")),
        2 * 60 * 1000,
      );
      try {
        libre.convert(docxBuffer, ".pdf", undefined, (err, done) => {
          clearTimeout(timeout);
          if (err) return reject(err);
          resolve(done);
        });
      } catch (err) {
        clearTimeout(timeout);
        return reject(err);
      }
    });

    await fsp.writeFile(pdfPath, pdfBuffer);
    convertedPdfPath = pdfPath;
  } catch (err) {
    console.warn(
      "libreoffice-convert failed:",
      err && err.message ? err.message : err,
    );

    if (isSofficeAvailable()) {
      try {
        const sofficePdf = await convertWithSoffice(absDocx, outDir);
        if (await fileExistsNonEmpty(sofficePdf)) {
          convertedPdfPath = sofficePdf;
        }
      } catch (sErr) {
        console.error(
          "soffice fallback failed:",
          sErr && sErr.message ? sErr.message : sErr,
        );
      }
    } else {
      console.error(
        "soffice is not available on PATH; please install LibreOffice.",
      );
    }

    if (!convertedPdfPath) {
      throw new Error(
        `DOCX to PDF conversion failed: ${
          err && err.message ? err.message : err
        }`,
      );
    }
  }

  const valid = Array.isArray(attachments)
    ? attachments.filter((att) => att && (att.file_path || att.file_name))
    : [];

  if (valid.length !== (attachments || []).length) {
    console.warn(
      `Filtered out ${
        (attachments || []).length - valid.length
      } attachments without file_path/file_name`,
    );
  }

  if (valid.length > 0) {
    const tempDir = path.join(__dirname, "../temp", String(orgId || "unknown"));
    try {
      await fsp.mkdir(tempDir, { recursive: true });
    } catch (e) {}

    try {
      return await mergeAttachments(convertedPdfPath, valid, orgId);
    } catch (mergeErr) {
      console.error(
        "mergeAttachments failed:",
        mergeErr && mergeErr.message ? mergeErr.message : mergeErr,
      );
      return convertedPdfPath;
    }
  }

  return convertedPdfPath;
};
