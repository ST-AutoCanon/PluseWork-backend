const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const libre = require("libreoffice-convert");

async function fileExistsNonEmpty(fp) {
  try {
    const st = await fsp.stat(fp);
    return st && st.size && st.size > 0;
  } catch (e) {
    return false;
  }
}

async function waitForFileNonEmpty(
  filePath,
  timeoutMs = 120000,
  intervalMs = 500
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const st = await fsp.stat(filePath);
      if (st && st.size && st.size > 0) return true;
    } catch (e) {}
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

function isSofficeAvailable() {
  try {
    const res = spawnSync("soffice", ["--version"], { encoding: "utf8" });
    return res && (res.status === 0 || (res.stdout && res.stdout.length > 0));
  } catch (e) {
    return false;
  }
}

async function convertWithSofficeWithRetries(docxPath, outDir, options = {}) {
  const { maxRetries = 4, timeoutMs = 120000 } = options;
  const pdfName = path.basename(docxPath).replace(/\.docx$/i, ".pdf");
  const pdfPath = path.join(outDir, pdfName);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const args = [
          "--headless",
          "--convert-to",
          "pdf",
          "--outdir",
          outDir,
          docxPath,
        ];
        const child = spawn("soffice", args, {
          stdio: ["ignore", "pipe", "pipe"],
        });

        let stderr = "";
        child.stderr.on("data", (d) => (stderr += d.toString()));
        child.on("error", (err) => {
          return reject(err);
        });
        child.on("exit", (code) => {
          if (code !== 0)
            return reject(
              new Error(`soffice exit code ${code}. stderr: ${stderr}`)
            );
          return resolve();
        });
      });

      const ok = await waitForFileNonEmpty(pdfPath, timeoutMs);
      if (ok && fs.existsSync(pdfPath)) return pdfPath;

      throw new Error("soffice did not produce a non-empty PDF within timeout");
    } catch (err) {
      if (err && err.code === "EBUSY" && attempt < maxRetries) {
        const backoff = 300 * attempt;
        console.warn(
          `soffice spawn EBUSY (attempt ${attempt}). retrying after ${backoff}ms`
        );
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      throw err;
    }
  }

  throw new Error("soffice conversion failed after retries");
}

exports.convertDocxToPdf = async (docxPath, claim = {}, attachments = []) => {
  if (!docxPath) throw new Error("docxPath required");
  const absDocx = path.resolve(docxPath);
  const outDir = path.dirname(absDocx);

  if (!(await fileExistsNonEmpty(absDocx))) {
    throw new Error(`DOCX file missing or empty: ${absDocx}`);
  }

  const pdfPath = absDocx.replace(/\.docx$/i, ".pdf");
  let convertedPdfPath = null;

  if (isSofficeAvailable()) {
    try {
      convertedPdfPath = await convertWithSofficeWithRetries(absDocx, outDir, {
        maxRetries: 4,
        timeoutMs: 120000,
      });
    } catch (soErr) {
      console.warn(
        "soffice conversion attempt failed:",
        soErr && soErr.message ? soErr.message : soErr
      );
      convertedPdfPath = null;
    }
  } else {
    console.warn("soffice not available on PATH; skipping soffice attempt.");
  }

  if (!convertedPdfPath) {
    try {
      const docxBuffer = await fsp.readFile(absDocx);
      if (!docxBuffer || docxBuffer.length === 0)
        throw new Error("DOCX buffer empty");

      const pdfBuffer = await new Promise((resolve, reject) => {
        let timeout = setTimeout(
          () => reject(new Error("libre.convert timeout")),
          180000
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
    } catch (libErr) {
      console.error(
        "libreoffice-convert fallback failed:",
        libErr && libErr.message ? libErr.message : libErr
      );
    }
  }

  if (!convertedPdfPath) {
    throw new Error(
      "DOCX to PDF conversion failed with both soffice and libre.convert"
    );
  }

  const valid =
    attachments && Array.isArray(attachments)
      ? attachments.filter((att) => att && att.file_path)
      : [];
  if (valid.length > 0) {
    try {
      return await mergeAttachments(convertedPdfPath, valid);
    } catch (mergeErr) {
      console.error(
        "mergeAttachments failed:",
        mergeErr && mergeErr.message ? mergeErr.message : mergeErr
      );
      return convertedPdfPath;
    }
  }

  return convertedPdfPath;
};
