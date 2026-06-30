const templateService = require("../services/templateService");
const path = require("path");
const fs = require("fs-extra");

function getUploadBaseDir() {
  return path.join(__dirname, "..", "..", "..", "BuildTemplates");
}

function getUploadDir(orgId, templateName = null) {
  if (!orgId) orgId = "unknown";
  let dir = path.join(getUploadBaseDir(), String(orgId));
  if (templateName) {
    const safeName = String(templateName)
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "_")
      .substring(0, 50);
    dir = path.join(dir, safeName);
  }
  return dir;
}

async function moveFileToUploads(
  tmpPath,
  originalName,
  orgId,
  templateName = null,
) {
  if (!tmpPath) {
    console.warn("moveFileToUploads: No tmpPath provided");
    return null;
  }

  const publicUploads = getUploadDir(orgId, templateName);

  console.log(`📁 Moving file from temp: ${tmpPath}`);
  console.log(`📁 Target directory: ${publicUploads}`);

  try {
    await fs.ensureDir(publicUploads);
    console.log(`✅ Upload directory ready: ${publicUploads}`);
  } catch (err) {
    console.error(`❌ Failed to create uploads directory: ${err.message}`);
    throw err;
  }

  const destName = `${Date.now()}_${path
    .basename(originalName || tmpPath)
    .replace(/\s/g, "_")}`;
  const destPath = path.join(publicUploads, destName);

  console.log(`📝 Destination filename: ${destName}`);
  console.log(`📝 Full destination path: ${destPath}`);

  try {
    await fs.ensureDir(path.dirname(destPath));
    await fs.move(tmpPath, destPath, { overwrite: true });
    console.log(`✅ File moved successfully: ${destName}`);

    const fileExists = await fs.pathExists(destPath);
    if (fileExists) {
      console.log(`✅ File verified at: ${destPath}`);
    } else {
      console.error(
        `❌ File move reported success but file not found at: ${destPath}`,
      );
    }

    return destName;
  } catch (err) {
    console.error(`❌ Failed to move file: ${err.message}`);
    throw err;
  }
}

function buildSimpleTemplateHtml(
  orgId,
  templateName,
  headerName,
  footerName,
  watermarkUrl = null,
  watermarkPlacement = null,
  headerProps = null,
  footerProps = null,
) {
  const headerUrl = headerName
    ? `/api/orgs/${orgId}/uploads/${headerName}`
    : null;
  const footerUrl = footerName
    ? `/api/orgs/${orgId}/uploads/${footerName}`
    : null;

  const grapesJson = {
    id: `scan-${Date.now()}`,
    watermark: watermarkUrl
      ? { url: watermarkUrl, ...watermarkPlacement }
      : null,
    components: [
      {
        tagName: "div",
        attributes: { class: "template-page", "data-org-template": true },
        style: { position: "relative", width: "100%", maxWidth: "100%" },
        components: [
          ...(headerUrl
            ? [
                {
                  type: "image",
                  attributes: {
                    src: headerUrl,
                    alt: "header",
                    class: "template-header",
                  },
                  style: headerProps
                    ? {
                        position: "absolute",
                        left: headerProps.xPct || "0%",
                        top: headerProps.yPct || "0%",
                        width: headerProps.wPct || "100%",
                        height: headerProps.hPct || "100%",
                        pointerEvents: "none",
                      }
                    : {
                        width: "100%",
                        display: "block",
                        pointerEvents: "none",
                      },
                  selectable: false,
                  draggable: false,
                },
              ]
            : []),
          {
            tagName: "div",
            attributes: { class: "template-body" },
            components: [],
            style: { minHeight: "200px", padding: "12px" },
          },
          ...(footerUrl
            ? [
                {
                  type: "image",
                  attributes: {
                    src: footerUrl,
                    alt: "footer",
                    class: "template-footer",
                  },
                  style: footerProps
                    ? {
                        position: "absolute",
                        left: footerProps.xPct || "0%",
                        top: footerProps.yPct || "0%",
                        width: footerProps.wPct || "100%",
                        height: footerProps.hPct || "100%",
                        pointerEvents: "none",
                      }
                    : {
                        width: "100%",
                        display: "block",
                        pointerEvents: "none",
                      },
                  selectable: false,
                  draggable: false,
                },
              ]
            : []),
        ],
      },
    ],
    styles: `
      .template-header { display:block; }
      .template-footer { display:block; }
    `,
  };

  const htmlParts = [];
  if (headerUrl)
    htmlParts.push(
      `<img src="${headerUrl}" class="template-header" alt="header" style="width:100%;display:block" />`,
    );
  htmlParts.push(
    `<div class="template-body" style="min-height:200px;padding:12px"></div>`,
  );
  if (footerUrl)
    htmlParts.push(
      `<img src="${footerUrl}" class="template-footer" alt="footer" style="width:100%;display:block" />`,
    );

  const html = `<div class="template-page">${htmlParts.join("\n")}</div>`;

  return { grapesJson, html, thumbnailName: headerName || footerName || null };
}

async function uploadScanHandler(req, res) {
  const orgId = parseInt(req.params.orgId, 10);
  const userId = req.user && req.user.id;
  const templateId = req.body.templateId
    ? parseInt(req.body.templateId, 10)
    : null;
  const headerFile = req.files && req.files.header && req.files.header[0];
  const footerFile = req.files && req.files.footer && req.files.footer[0];
  const bodyFile = req.files && req.files.body && req.files.body[0];
  const watermarkFile =
    req.files && req.files.watermark && req.files.watermark[0];
  const qrFile = req.files && req.files.qr && req.files.qr[0];
  const sealFile = req.files && req.files.seal && req.files.seal[0];

  if (
    !headerFile &&
    !bodyFile &&
    !footerFile &&
    !watermarkFile &&
    !qrFile &&
    !sealFile
  ) {
    return res.status(400).json({
      error:
        "At least one image (header, body, footer, watermark, qr or seal) is required",
    });
  }

  try {
    const nameFromClient =
      (req.body && req.body.name) ||
      `Uploaded template ${new Date().toISOString()}`;

    const templateFolderName = String(nameFromClient)
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "_")
      .substring(0, 50);

    console.log(`\n📝 TEMPLATE UPLOAD STARTED`);
    console.log(`   Template Name: ${nameFromClient}`);
    console.log(`   Folder Name: ${templateFolderName}`);
    console.log(`   Org ID: ${orgId}`);
    console.log(
      `   Files: Header=${!!headerFile}, Footer=${!!footerFile}, QR=${!!qrFile}, Seal=${!!sealFile}\n`,
    );

    const headerName = headerFile
      ? await moveFileToUploads(
          headerFile.path,
          headerFile.originalname,
          orgId,
          templateFolderName,
        )
      : null;
    const bodyName = bodyFile
      ? await moveFileToUploads(
          bodyFile.path,
          bodyFile.originalname,
          orgId,
          templateFolderName,
        )
      : null;
    const footerName = footerFile
      ? await moveFileToUploads(
          footerFile.path,
          footerFile.originalname,
          orgId,
          templateFolderName,
        )
      : null;
    const watermarkName = watermarkFile
      ? await moveFileToUploads(
          watermarkFile.path,
          watermarkFile.originalname,
          orgId,
          templateFolderName,
        )
      : null;
    const qrName = qrFile
      ? await moveFileToUploads(
          qrFile.path,
          qrFile.originalname,
          orgId,
          templateFolderName,
        )
      : null;
    const sealName = sealFile
      ? await moveFileToUploads(
          sealFile.path,
          sealFile.originalname,
          orgId,
          templateFolderName,
        )
      : null;

    let watermarkPlacement = null;
    let bodyType = "letter";
    let incomingWatermarkFlag = false;
    let headerProps = null;
    let footerProps = null;
    try {
      if (req.body && req.body.meta) {
        const meta =
          typeof req.body.meta === "string"
            ? JSON.parse(req.body.meta)
            : req.body.meta;
        watermarkPlacement = meta.watermarkPlacement || null;
        bodyType = meta.bodyType || "letter";
        incomingWatermarkFlag = !!meta.watermark;
        headerProps = meta.headerProps || null;
        footerProps = meta.footerProps || null;
      }
    } catch (e) {
      console.warn("uploadScanHandler: meta parse failed", e);
    }

    let incomingLayout = null;
    let incomingGrapesJson = null;
    let incomingHtml = null;
    let incomingCss = null;

    try {
      if (req.body) {
        if (req.body.layout) {
          incomingLayout =
            typeof req.body.layout === "string"
              ? JSON.parse(req.body.layout)
              : req.body.layout;
        }
        if (req.body.grapes_json) {
          incomingGrapesJson =
            typeof req.body.grapes_json === "string"
              ? JSON.parse(req.body.grapes_json)
              : req.body.grapes_json;
        }
        if (req.body.html) {
          incomingHtml = req.body.html;
        }
        if (req.body.css) {
          incomingCss = req.body.css;
        }
      }
    } catch (e) {
      console.warn("uploadScanHandler: parsing incoming fields failed", e);
    }

    const existingWatermarkUrl =
      (req.body && req.body.existingWatermarkUrl) || null;
    const watermarkUrlForGrapes = watermarkName
      ? `/api/orgs/${orgId}/uploads/${watermarkName}`
      : existingWatermarkUrl;

    let grapesJsonBuilt = null;
    let htmlBuilt = null;
    let thumbnailName = headerName || footerName || null;

    console.log("header uploaded:", headerName);
    console.log("footer uploaded:", footerName);
    console.log(
      "incoming grapes footer:",
      JSON.stringify(incomingGrapesJson, null, 2),
    );

    if (incomingGrapesJson) {
      grapesJsonBuilt = incomingGrapesJson;
    } else {
      const built = buildSimpleTemplateHtml(
        orgId,
        templateFolderName,
        headerName,
        footerName,
        watermarkUrlForGrapes,
        watermarkPlacement,
        headerProps,
        footerProps,
      );
      grapesJsonBuilt = built.grapesJson;
      htmlBuilt = built.html;
      thumbnailName = built.thumbnailName || thumbnailName;
    }

    const finalHtml = incomingHtml || htmlBuilt;
    const finalLayout = Array.isArray(incomingLayout) ? incomingLayout : null;

    let existingUploads = {};

    if (templateId) {
      try {
        const existingTemplate = await templateService.getTemplateById(
          orgId,
          templateId,
        );

        if (existingTemplate?.meta) {
          const existingMeta =
            typeof existingTemplate.meta === "string"
              ? JSON.parse(existingTemplate.meta)
              : existingTemplate.meta;

          existingUploads = existingMeta?.uploads || {};
        }

        console.log("Existing uploads:", existingUploads);
      } catch (err) {
        console.warn("Failed to load existing template uploads:", err);
      }
    }

    if (req.body.existingUploads) {
      try {
        const clientUploads =
          typeof req.body.existingUploads === "string"
            ? JSON.parse(req.body.existingUploads)
            : req.body.existingUploads;

        existingUploads = {
          ...existingUploads,
          ...clientUploads,
        };
      } catch (err) {
        console.warn("Failed to parse existingUploads from request:", err);
      }
    }

    const uploadedUrls = {
      header: headerName
        ? `/api/orgs/${orgId}/uploads/${headerName}`
        : existingUploads.header || null,

      body: bodyName
        ? `/api/orgs/${orgId}/uploads/${bodyName}`
        : existingUploads.body || null,

      footer: footerName
        ? `/api/orgs/${orgId}/uploads/${footerName}`
        : existingUploads.footer || null,

      watermark: watermarkName
        ? `/api/orgs/${orgId}/uploads/${watermarkName}`
        : existingUploads.watermark || null,

      qr: qrName
        ? `/api/orgs/${orgId}/uploads/${qrName}`
        : existingUploads.qr || null,

      seal: sealName
        ? `/api/orgs/${orgId}/uploads/${sealName}`
        : existingUploads.seal || null,
    };

    console.log("Final uploadedUrls:", uploadedUrls);

    const applyUrlsToLayout = (boxes) => {
      if (!Array.isArray(boxes)) return;

      for (const b of boxes) {
        if (!b.style) b.style = {};

        const fieldName = String(
          b.fieldName || b.name || b.id || "",
        ).toLowerCase();

        if (/(qr|qrcode|qr_code)/i.test(fieldName) && uploadedUrls.qr) {
          b.imageUrl = uploadedUrls.qr;
          b.content = uploadedUrls.qr;
          console.log(`✅ Assigned QR URL to box: ${b.fieldName || b.id}`);
        }

        if (
          /(seal|stamp|companyseal|logo)/i.test(fieldName) &&
          uploadedUrls.seal
        ) {
          b.imageUrl = uploadedUrls.seal;
          b.content = uploadedUrls.seal;
          console.log(`✅ Assigned Seal URL to box: ${b.fieldName || b.id}`);
        }
      }
    };

    const ensureQrSealBoxes = (boxes) => {
      if (!Array.isArray(boxes)) boxes = [];

      const hasQrBox = boxes.some((b) =>
        /(qr|qrcode)/i.test(String(b.fieldName || b.name || b.id || "")),
      );
      const hasSealBox = boxes.some((b) =>
        /(seal|stamp)/i.test(String(b.fieldName || b.name || b.id || "")),
      );

      if (uploadedUrls.qr && !hasQrBox) {
        console.log(`📦 Creating QR box - file uploaded but no box found`);
        boxes.push({
          id: `qr-${Date.now()}`,
          type: "image",
          fieldName: "qrCode",
          name: "QR Code",
          imageUrl: uploadedUrls.qr,
          content: uploadedUrls.qr,
          xPct: "70%",
          yPct: "5%",
          wPct: "25%",
          hPct: "15%",
          style: {
            background: "transparent",
            width: "100%",
            height: "100%",
            objectFit: "contain",
          },
        });
      }

      if (uploadedUrls.seal && !hasSealBox) {
        console.log(`📦 Creating Seal box - file uploaded but no box found`);
        boxes.push({
          id: `seal-${Date.now()}`,
          type: "image",
          fieldName: "companySeal",
          name: "Company Seal",
          imageUrl: uploadedUrls.seal,
          content: uploadedUrls.seal,
          xPct: "70%",
          yPct: "25%",
          wPct: "25%",
          hPct: "15%",
          style: {
            background: "transparent",
            width: "100%",
            height: "100%",
            objectFit: "contain",
          },
        });
      }

      return boxes;
    };

    if (finalLayout) {
      applyUrlsToLayout(finalLayout);
      ensureQrSealBoxes(finalLayout);
    } else if (uploadedUrls.qr || uploadedUrls.seal) {
      const newLayout = [];
      ensureQrSealBoxes(newLayout);
      if (newLayout.length > 0) {
        finalLayout = newLayout;
      }
    }

    if (grapesJsonBuilt && Array.isArray(grapesJsonBuilt.layout)) {
      applyUrlsToLayout(grapesJsonBuilt.layout);
      ensureQrSealBoxes(grapesJsonBuilt.layout);
    } else if (grapesJsonBuilt && finalLayout) {
      try {
        grapesJsonBuilt.layout = finalLayout;
      } catch (e) {
        console.warn("Failed to embed layout into grapes_json", e);
      }
    }

    try {
      if (!grapesJsonBuilt || typeof grapesJsonBuilt !== "object") {
        grapesJsonBuilt = { id: `scan-${Date.now()}`, components: [] };
      }

      if (finalLayout && Array.isArray(finalLayout)) {
        grapesJsonBuilt.layout = finalLayout;
      } else if (!Array.isArray(grapesJsonBuilt.layout)) {
        grapesJsonBuilt.layout = grapesJsonBuilt.layout || [];
      }

      if (uploadedUrls.header) {
        grapesJsonBuilt.headerUrl = uploadedUrls.header;
      }
      if (uploadedUrls.footer) {
        grapesJsonBuilt.footerUrl = uploadedUrls.footer;
      }
      if (uploadedUrls.qr) {
        grapesJsonBuilt.qrUrl = uploadedUrls.qr;
      }
      if (uploadedUrls.seal) {
        grapesJsonBuilt.sealUrl = uploadedUrls.seal;
      }
      if (uploadedUrls.watermark) {
        grapesJsonBuilt.watermark = grapesJsonBuilt.watermark || {};
        grapesJsonBuilt.watermark.url = uploadedUrls.watermark;
        if (watermarkPlacement) {
          grapesJsonBuilt.watermark.xPct =
            watermarkPlacement.xPct || grapesJsonBuilt.watermark.xPct;
          grapesJsonBuilt.watermark.yPct =
            watermarkPlacement.yPct || grapesJsonBuilt.watermark.yPct;
          grapesJsonBuilt.watermark.wPct =
            watermarkPlacement.wPct || grapesJsonBuilt.watermark.wPct;
          grapesJsonBuilt.watermark.hPct =
            watermarkPlacement.hPct || grapesJsonBuilt.watermark.hPct;
          if (typeof watermarkPlacement.opacity === "number")
            grapesJsonBuilt.watermark.opacity = watermarkPlacement.opacity;
        }
      } else if (watermarkUrlForGrapes) {
        grapesJsonBuilt.watermark = grapesJsonBuilt.watermark || {};
        grapesJsonBuilt.watermark.url =
          grapesJsonBuilt.watermark.url || watermarkUrlForGrapes;
      }
    } catch (e) {
      console.warn(
        "uploadScanHandler: failed to attach URLs into grapes_json",
        e,
      );
    }

    const metaObj = {
      bodyType,
      watermark: !!watermarkName || incomingWatermarkFlag,
      watermarkPlacement: watermarkPlacement || null,
      headerProps: headerProps || null,
      footerProps: footerProps || null,
      uploads: {
        header: uploadedUrls.header || null,
        footer: uploadedUrls.footer || null,
        watermark: uploadedUrls.watermark || null,
        qr: uploadedUrls.qr || null,
        seal: uploadedUrls.seal || null,
      },
    };

    const savePayload = {
      name: nameFromClient,
      template_type: "scan",
      grapes_json: grapesJsonBuilt || null,
      html: finalHtml || null,
      css: incomingCss || null,
      thumbnail_url: thumbnailName || null,
      meta: JSON.stringify(metaObj),
      layout: finalLayout ? JSON.stringify(finalLayout) : null,
    };

    console.log(`\n✅ LAYOUT BEFORE SAVE:`);
    if (finalLayout && Array.isArray(finalLayout)) {
      console.log(`   Total boxes: ${finalLayout.length}`);
      finalLayout.forEach((box, idx) => {
        const fieldName = String(box.fieldName || box.name || "unknown");
        const hasUrl = !!(box.imageUrl || box.content);
        console.log(
          `   [${idx}] ${fieldName}: type=${box.type}, hasImage=${hasUrl}`,
        );
      });
    }
    console.log(`\n`);

    console.log(`📦 SAVING URLS IN LAYOUT:`);
    console.log(`   QR: ${uploadedUrls.qr || "null"}`);
    console.log(`   Seal: ${uploadedUrls.seal || "null"}\n`);

    console.log(`📊 Saving template: ${nameFromClient}`);
    console.log(
      `   Layout boxes count: ${finalLayout ? finalLayout.length : 0}`,
    );
    console.log(
      `   grapesJson.layout count: ${grapesJsonBuilt && grapesJsonBuilt.layout ? grapesJsonBuilt.layout.length : 0}`,
    );

    let template;

    if (templateId) {
      await templateService.updateTemplate(
        orgId,
        templateId,
        userId,
        savePayload,
      );

      template = await templateService.getTemplateById(orgId, templateId);
    } else {
      const saved = await templateService.saveTemplate(
        orgId,
        userId,
        savePayload,
      );

      template = await templateService.getTemplateById(orgId, saved.id);
    }

    return res.json(template);
  } catch (err) {
    console.error("uploadScanHandler", err);
    return res.status(500).json({ error: err.message || "Save failed" });
  }
}

async function uploadImageHandler(req, res) {
  try {
    const orgId = parseInt(req.params.orgId, 10);
    const file = req.file;
    if (!file) return res.status(400).json({ error: "file required" });

    const destName = await moveFileToUploads(
      file.path,
      file.originalname,
      orgId,
    );

    return res.json({ success: true, filename: destName });
  } catch (err) {
    console.error("uploadImageHandler", err);
    return res.status(500).json({ error: "Failed to upload" });
  }
}

async function saveTemplateHandler(req, res) {
  const orgId = parseInt(req.params.orgId, 10);
  const payload = req.body;
  const userId = req.user && req.user.id;

  try {
    const result = await templateService.saveTemplate(orgId, userId, payload);
    const insertedId = result.id;

    const fullRow = await templateService.getTemplateById(orgId, insertedId);

    return res.json(fullRow);
  } catch (err) {
    console.error("saveTemplateHandler", err);
    return res.status(500).json({ error: err.message });
  }
}

async function listTemplatesHandler(req, res) {
  const orgId = parseInt(req.params.orgId, 10);
  try {
    const rows = await templateService.getTemplates(orgId);

    const parsed = (rows || []).map((r) => {
      const out = { ...r };
      try {
        if (typeof out.grapes_json === "string" && out.grapes_json) {
          out.grapes_json = JSON.parse(out.grapes_json);
        }
      } catch (e) {}
      try {
        if (typeof out.meta === "string" && out.meta) {
          out.meta = JSON.parse(out.meta);
        }
      } catch (e) {}

      try {
        if (typeof out.layout === "string" && out.layout) {
          out.layout = JSON.parse(out.layout);
        }
      } catch (e) {}

      return out;
    });

    return res.json(parsed);
  } catch (err) {
    console.error("listTemplatesHandler", err);
    return res.status(500).json({ error: err.message });
  }
}

async function findFileInOrg(orgId, filename) {
  if (!orgId || !filename) {
    console.log(`❌ findFileInOrg: Missing orgId or filename`);
    return null;
  }

  const orgBase = getUploadDir(orgId);
  console.log(`🔍 Looking for file: ${filename}`);
  console.log(`🔍 In directory: ${orgBase}`);

  try {
    const dirExists = await fs.pathExists(orgBase);
    if (!dirExists) {
      console.log(`❌ Org directory does not exist: ${orgBase}`);
      return null;
    }

    const entries = await fs.readdir(orgBase);
    console.log(`📂 Found ${entries.length} entries in org directory`);

    for (const entry of entries) {
      const subdir = path.join(orgBase, entry);
      const filePath = path.join(subdir, filename);

      console.log(`  ↳ Checking: ${filePath}`);

      if (await fs.pathExists(filePath)) {
        console.log(`✅ Found file at: ${filePath}`);
        return filePath;
      }
    }

    console.log(`❌ File not found in any template folder: ${filename}`);
    return null;
  } catch (err) {
    console.error(`❌ findFileInOrg error: ${err.message}`);
    return null;
  }
}

async function serveUploadedFileHandler(req, res) {
  try {
    const { orgId, filename } = req.params;

    if (!filename) {
      return res.status(400).json({ error: "Filename required" });
    }

    if (!orgId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    console.log(`\n🔎 serveUploadedFileHandler REQUEST`);
    console.log(`   orgId: ${orgId}`);
    console.log(`   filename: ${filename}`);

    let filePath = await findFileInOrg(orgId, filename);

    if (!filePath) {
      console.warn(
        `❌ File not found for orgId ${orgId}, filename ${filename}`,
      );
      return res.status(404).json({
        error: "File not found",
        details: `File ${filename} not found in organization ${orgId}`,
      });
    }

    console.log(`✅ Serving file: ${filePath}`);
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.sendFile(filePath);
  } catch (err) {
    console.error("serveUploadedFileHandler error:", err);
    return res.status(500).json({
      error: "Failed to serve file",
      details: err.message,
    });
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

async function updateTemplateHandler(req, res) {
  const orgId = parseInt(req.params.orgId, 10);
  const templateId = parseInt(req.params.templateId, 10);
  const userId = req.user && req.user.id;

  try {
    const result = await templateService.updateTemplate(
      orgId,
      templateId,
      userId,
      req.body,
    );

    return res.json(result);
  } catch (err) {
    console.error("updateTemplateHandler", err);
    return res.status(500).json({ error: err.message });
  }
}

async function deleteTemplateHandler(req, res) {
  const orgId = parseInt(req.params.orgId, 10);
  const templateId = parseInt(req.params.templateId, 10);

  try {
    const result = await templateService.deleteTemplate(orgId, templateId);

    return res.json(result);
  } catch (err) {
    console.error("deleteTemplateHandler", err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  uploadScanHandler,
  uploadImageHandler,
  saveTemplateHandler,
  listTemplatesHandler,
  serveUploadedFileHandler,
  listBasicTemplatesHandler,
  updateTemplateHandler,
  deleteTemplateHandler,
};
