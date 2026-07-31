const libre = require("libreoffice-convert");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

// Use convertWithOptions so we can pass sofficeBinaryPaths
const convertAsync = promisify(libre.convertWithOptions);

// Set the correct path (change only if your install is elsewhere)
const SOFFICE_PATH =
  process.env.LIBREOFFICE_PATH ||
  "C:\\Program Files\\LibreOffice\\program\\soffice.exe";

async function convertToPdf(inputPath) {
  console.log(">>> convertToPdf called:", inputPath);

  const ext = path.extname(inputPath).toLowerCase();

  if (![".doc", ".docx", ".ppt", ".pptx"].includes(ext)) {
    return null;
  }

  if (!fs.existsSync(SOFFICE_PATH)) {
    throw new Error(
      `LibreOffice binary not found at: ${SOFFICE_PATH}\n` +
        `Please install LibreOffice or set LIBREOFFICE_PATH env variable.`
    );
  }

  const outputPath = inputPath.replace(ext, ".pdf");

  try {
    const fileBuffer = fs.readFileSync(inputPath);

    // IMPORTANT: 4th argument is the options object
    const pdfBuffer = await convertAsync(fileBuffer, ".pdf", undefined, {
      sofficeBinaryPaths: [SOFFICE_PATH],
    });

    fs.writeFileSync(outputPath, pdfBuffer);
    console.log(">>> Converted successfully to:", outputPath);
    return outputPath;
  } catch (err) {
    console.error(">>> LibreOffice conversion error:", err.message);
    throw err;
  }
}

module.exports = {
  convertToPdf,
};