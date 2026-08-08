const libre = require("libreoffice-convert");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const convertAsync = promisify(libre.convertWithOptions);

// -------------------------------------------------
// Detect LibreOffice automatically or use env var
// -------------------------------------------------
function findSoffice() {
  // 1. Explicit env variable (recommended)
  if (process.env.LIBREOFFICE_PATH && fs.existsSync(process.env.LIBREOFFICE_PATH)) {
    return process.env.LIBREOFFICE_PATH;
  }

  // 2. Common Windows locations
  const windowsCandidates = [
    "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
    "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
  ];

  // 3. Common Linux / macOS locations
  const unixCandidates = [
    "/usr/bin/soffice",
    "/usr/bin/libreoffice",
    "/usr/lib/libreoffice/program/soffice",
    "/opt/libreoffice*/program/soffice",   // sometimes versioned
  ];

  const candidates = process.platform === "win32" ? windowsCandidates : unixCandidates;

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  // 4. Try PATH
  try {
    const { execSync } = require("child_process");
    const which = process.platform === "win32" ? "where" : "which";
    const result = execSync(`${which} soffice`, { encoding: "utf8" }).trim().split("\n")[0];
    if (result && fs.existsSync(result)) return result;
  } catch (_) {}

  return null;
}

const SOFFICE_PATH = findSoffice();

async function convertToPdf(inputPath) {
  console.log(">>> convertToPdf called:", inputPath);

  if (!SOFFICE_PATH) {
    throw new Error(
      "LibreOffice binary not found.\n" +
      "Install LibreOffice and/or set the environment variable:\n" +
      "  LIBREOFFICE_PATH=/full/path/to/soffice   (or soffice.exe on Windows)"
    );
  }

  console.log(">>> Using LibreOffice at:", SOFFICE_PATH);

  const ext = path.extname(inputPath).toLowerCase();
  if (![".doc", ".docx", ".ppt", ".pptx"].includes(ext)) {
    return null;
  }

  const outputPath = inputPath.replace(ext, ".pdf");

  try {
    const fileBuffer = fs.readFileSync(inputPath);

    const pdfBuffer = await convertAsync(fileBuffer, ".pdf", undefined, {
      sofficeBinaryPaths: [SOFFICE_PATH],
    });

    fs.writeFileSync(outputPath, pdfBuffer);
    console.log(">>> Converted successfully to:", outputPath);
    return outputPath;
  } catch (err) {
    console.error(">>> LibreOffice conversion error:", err.message);
    throw err;   // let the caller decide what to do
  }
}

module.exports = { convertToPdf };