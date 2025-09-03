const templateService = require("../services/templateService");
const path = require("path");
const fs = require("fs-extra");

async function uploadScanHandler(req, res) {
  const orgId = parseInt(req.params.orgId, 10);
  const userId = req.user && req.user.id;

  // Expect req.files = { header: [{...}], body: [{...}], footer: [{...}] }
  if (!req.files || !req.files.body || !req.files.body[0]) {
    return res.status(400).json({ error: "body file required" });
  }

  try {
    const headerFile = req.files.header && req.files.header[0];
    const bodyFile = req.files.body && req.files.body[0];
    const footerFile = req.files.footer && req.files.footer[0];

    const result = await templateService.processScanToTemplate({
      orgId,
      userId,
      headerPath: headerFile ? headerFile.path : null,
      headerOriginal: headerFile ? headerFile.originalname : null,
      bodyPath: bodyFile.path,
      bodyOriginal: bodyFile.originalname,
      footerPath: footerFile ? footerFile.path : null,
      footerOriginal: footerFile ? footerFile.originalname : null,
    });

    return res.json(result);
  } catch (err) {
    console.error("uploadScanHandler", err);
    return res.status(500).json({ error: err.message || "OCR failed" });
  }
}

async function saveTemplateHandler(req, res) {
  const orgId = parseInt(req.params.orgId, 10);
  const payload = req.body;
  const userId = req.user && req.user.id;
  try {
    const row = await templateService.saveTemplate(orgId, userId, payload);
    return res.json(row);
  } catch (err) {
    console.error("saveTemplateHandler", err);
    return res.status(500).json({ error: err.message });
  }
}

async function listTemplatesHandler(req, res) {
  const orgId = parseInt(req.params.orgId, 10);
  try {
    const rows = await templateService.getTemplates(orgId);
    return res.json(rows);
  } catch (err) {
    console.error("listTemplatesHandler", err);
    return res.status(500).json({ error: err.message });
  }
}

async function serveUploadedFileHandler(req, res) {
  try {
    const { orgId, filename } = req.params;
    console.log("orgId, filename", orgId, filename);
    const uploadsDir = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "public",
      "uploads"
    );
    const filePath = path.join(uploadsDir, filename);
    console.log("filePath", filePath);

    const exists = await fs.pathExists(filePath);
    console.log("exists", exists);
    if (!exists) return res.status(404).json({ error: "Not found" });

    return res.sendFile(filePath);
  } catch (err) {
    console.log("err", err);
    console.error("serveUploadedFileHandler", err);
    return res.status(500).json({ error: "Failed to serve file" });
  }
}

async function listBasicTemplatesHandler(req, res) {
  try {
    const basicDir = path.join(__dirname, "..", "..", "templates", "basic");
    await fs.ensureDir(basicDir);
    const files = await fs.readdir(basicDir);

    const templates = [];
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (ext === ".json") {
        const meta = await fs.readJSON(path.join(basicDir, file));
        templates.push(meta);
      } else if (ext === ".html") {
        const html = await fs.readFile(path.join(basicDir, file), "utf8");
        templates.push({
          id: file,
          name: path.basename(file, ".html"),
          html,
          grapesJson: { components: [{ content: html }] },
          thumbnail: null,
        });
      } else if ((await fs.stat(path.join(basicDir, file))).isDirectory()) {
        const dir = path.join(basicDir, file);
        const metaPath = path.join(dir, "metadata.json");
        if (await fs.pathExists(metaPath)) {
          const meta = await fs.readJSON(metaPath);
          templates.push(meta);
        }
      }
    }

    return res.json(templates);
  } catch (err) {
    console.error("listBasicTemplatesHandler", err);
    return res.status(500).json({ error: "Failed to list basic templates" });
  }
}

module.exports = {
  uploadScanHandler,
  saveTemplateHandler,
  listTemplatesHandler,
  serveUploadedFileHandler,
  listBasicTemplatesHandler,
};
