// src/services/pdfService.js

const { PDFDocument } = require("pdf-lib");
const fs = require("fs");
const libre = require("libreoffice-convert");
const sharp = require("sharp");

// ── Helper: extract images from a PDF attachment ─────────────────────────────
async function extractImagesFromPdf(pdfPath) {
  const bytes = fs.readFileSync(pdfPath);
  const srcPdf = await PDFDocument.load(bytes);
  const context = srcPdf.context;
  const images = [];

  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (!obj || !obj.dict) continue;
    const subtype = obj.dict.get("Subtype");
    if (subtype && subtype.name === "Image") {
      const imageBytes = obj.contents;
      const filter = obj.dict.get("Filter");

      if (filter && filter.name === "DCTDecode") {
        // JPEG image stream
        images.push({ data: imageBytes, type: "jpg" });
      } else {
        // Other (likely PNG or raw); normalize to PNG via Sharp
        const pngBuffer = await sharp(imageBytes).png().toBuffer();
        images.push({ data: pngBuffer, type: "png" });
      }
    }
  }

  return images; // [{ data: Buffer, type: "png"|"jpg" }, ...]
}

// ── Helper: normalize standalone images ───────────────────────────────────────
async function optimizeImage(imagePath) {
  return sharp(imagePath)
    .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
    .toBuffer();
}

// ── Merge attachments into the PDF ────────────────────────────────────────────
// ── Merge attachments into the PDF (improved) ────────────────────────────────
async function mergeAttachments(pdfPath, attachments) {
  // Load the base PDF (converted from your DOCX)
  const pdfDoc = await PDFDocument.load(fs.readFileSync(pdfPath));

  for (const att of attachments) {
    if (!att.file_path || !fs.existsSync(att.file_path)) {
      console.warn("Skipping invalid attachment:", att.file_path);
      continue;
    }

    const ext = att.file_path.toLowerCase().split(".").pop();

    if (ext === "pdf") {
      // ── Import all pages of the attached PDF ───────────────────────────────
      try {
        const otherPdfBytes = fs.readFileSync(att.file_path);
        const otherPdf = await PDFDocument.load(otherPdfBytes);
        const total = otherPdf.getPageCount();
        const pages = await pdfDoc.copyPages(otherPdf, [
          ...Array(total).keys(),
        ]);
        pages.forEach((page) => pdfDoc.addPage(page));
      } catch (err) {
        console.error("Failed to import PDF pages:", att.file_path, err);
      }
    } else if (["png", "jpg", "jpeg"].includes(ext)) {
      // ── Normalize and embed a standalone image ────────────────────────────
      let buffer;
      try {
        buffer = await optimizeImage(att.file_path);
      } catch (err) {
        console.error("Failed to optimize image:", att.file_path, err);
        continue;
      }

      let embedded;
      if (ext === "png") {
        embedded = await pdfDoc.embedPng(buffer);
      } else {
        embedded = await pdfDoc.embedJpg(buffer);
      }
      const page = pdfDoc.addPage([595, 842]);
      page.drawImage(embedded, { x: 50, y: 50, width: 500, height: 700 });
    } else {
      console.warn("Unsupported attachment type, skipping:", att.file_path);
    }
  }

  // Save out the merged PDF
  const finalPdfPath = pdfPath.replace(".pdf", "_final.pdf");
  fs.writeFileSync(finalPdfPath, await pdfDoc.save());
  return finalPdfPath;
}

// ── Main export: convert DOCX → PDF and merge attachments ────────────────────
exports.convertDocxToPdf = async (docxPath, claim, attachments = []) => {
  // 1) DOCX → PDF
  const pdfPath = docxPath.replace(".docx", ".pdf");
  try {
    const docxBuffer = fs.readFileSync(docxPath);
    const pdfBuffer = await new Promise((resolve, reject) => {
      libre.convert(docxBuffer, ".pdf", undefined, (err, done) => {
        if (err) return reject(err);
        resolve(done);
      });
    });
    fs.writeFileSync(pdfPath, pdfBuffer);
  } catch (error) {
    console.error("Error during DOCX to PDF conversion:", error);
    throw error;
  }

  // 2) Filter attachments to those with valid file_path
  const valid = attachments.filter((att) => att.file_path);
  if (valid.length !== attachments.length) {
    console.warn(
      `Filtered out ${
        attachments.length - valid.length
      } attachments without file_path`
    );
  }

  // 3) Merge if any valid attachments remain
  if (valid.length > 0) {
    return mergeAttachments(pdfPath, valid);
  }

  // 4) Otherwise just return the plain PDF
  return pdfPath;
};
