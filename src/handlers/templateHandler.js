const templateService = require("../services/templateService");
const path = require("path");
const fs = require("fs-extra");

async function moveFileToUploads(tmpPath, originalName) {
  if (!tmpPath) return null;
  const publicUploads = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "public",
    "uploads"
  );
  await fs.ensureDir(publicUploads);

  const destName = `${Date.now()}_${path
    .basename(originalName || tmpPath)
    .replace(/\s/g, "_")}`;
  const destPath = path.join(publicUploads, destName);

  await fs.ensureDir(path.dirname(destPath));
  await fs.move(tmpPath, destPath, { overwrite: true });

  return destName;
}

function buildSimpleTemplateHtml(
  orgId,
  headerName,
  footerName,
  watermarkUrl = null,
  watermarkPlacement = null
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
                  style: {
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
                  style: {
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
      `<img src="${headerUrl}" class="template-header" alt="header" style="width:100%;display:block" />`
    );
  htmlParts.push(
    `<div class="template-body" style="min-height:200px;padding:12px"></div>`
  );
  if (footerUrl)
    htmlParts.push(
      `<img src="${footerUrl}" class="template-footer" alt="footer" style="width:100%;display:block" />`
    );

  const html = `<div class="template-page">${htmlParts.join("\n")}</div>`;

  return { grapesJson, html, thumbnailName: headerName || footerName || null };
}

async function uploadScanHandler(req, res) {
  const orgId = parseInt(req.params.orgId, 10);
  const userId = req.user && req.user.id;

  // uploaded files (multer fields)
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
    // move uploaded files into public/uploads and get dest names
    const headerName = headerFile
      ? await moveFileToUploads(headerFile.path, headerFile.originalname)
      : null;
    const bodyName = bodyFile
      ? await moveFileToUploads(bodyFile.path, bodyFile.originalname)
      : null;
    const footerName = footerFile
      ? await moveFileToUploads(footerFile.path, footerFile.originalname)
      : null;
    const watermarkName = watermarkFile
      ? await moveFileToUploads(watermarkFile.path, watermarkFile.originalname)
      : null;
    const qrName = qrFile
      ? await moveFileToUploads(qrFile.path, qrFile.originalname)
      : null;
    const sealName = sealFile
      ? await moveFileToUploads(sealFile.path, sealFile.originalname)
      : null;

    // parse meta and optional incoming fields
    let watermarkPlacement = null;
    let bodyType = "letter";
    let incomingWatermarkFlag = false;
    try {
      if (req.body && req.body.meta) {
        const meta =
          typeof req.body.meta === "string"
            ? JSON.parse(req.body.meta)
            : req.body.meta;
        watermarkPlacement = meta.watermarkPlacement || null;
        bodyType = meta.bodyType || "letter";
        incomingWatermarkFlag = !!meta.watermark;
      }
    } catch (e) {
      console.warn("uploadScanHandler: meta parse failed", e);
    }

    // parse layout, grapes_json, html, fileMap from req.body (FormData fields)
    let incomingLayout = null;
    let incomingGrapesJson = null;
    let incomingHtml = null;
    let incomingFileMap = null;
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
        if (req.body.fileMap) {
          incomingFileMap =
            typeof req.body.fileMap === "string"
              ? JSON.parse(req.body.fileMap)
              : req.body.fileMap;
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

    // Build grapesJson (prefer incoming from client; fallback to simple built one)
    let grapesJsonBuilt = null;
    let htmlBuilt = null;
    let thumbnailName = headerName || footerName || null;

    if (incomingGrapesJson) {
      grapesJsonBuilt = incomingGrapesJson;
    } else {
      const built = buildSimpleTemplateHtml(
        orgId,
        headerName,
        footerName,
        watermarkUrlForGrapes,
        watermarkPlacement
      );
      grapesJsonBuilt = built.grapesJson;
      htmlBuilt = built.html;
      thumbnailName = built.thumbnailName || thumbnailName;
    }

    const finalHtml = incomingHtml || htmlBuilt;
    const finalLayout = Array.isArray(incomingLayout) ? incomingLayout : null;

    // URLs for files we moved
    const uploadedUrls = {
      header: headerName ? `/api/orgs/${orgId}/uploads/${headerName}` : null,
      body: bodyName ? `/api/orgs/${orgId}/uploads/${bodyName}` : null,
      footer: footerName ? `/api/orgs/${orgId}/uploads/${footerName}` : null,
      watermark: watermarkName
        ? `/api/orgs/${orgId}/uploads/${watermarkName}`
        : null,
      qr: qrName ? `/api/orgs/${orgId}/uploads/${qrName}` : null,
      seal: sealName ? `/api/orgs/${orgId}/uploads/${sealName}` : null,
    };

    // If client provided fileMap, use it. Expected shape: { qr: "<boxIdOrFieldName>", seal: "<boxIdOrFieldName>" }
    if (incomingFileMap && typeof incomingFileMap === "object") {
      const mapKeyToUrl = {};
      // map incomingFileMap value -> uploaded url
      if (incomingFileMap.qr && uploadedUrls.qr) {
        mapKeyToUrl[incomingFileMap.qr] = uploadedUrls.qr;
      }
      if (incomingFileMap.seal && uploadedUrls.seal) {
        mapKeyToUrl[incomingFileMap.seal] = uploadedUrls.seal;
      }

      const replaceInBoxes = (boxes) => {
        if (!Array.isArray(boxes)) return boxes;
        for (const b of boxes) {
          const key = b.id || b.fieldName || b.name;
          if (!key) continue;
          // exact match against fileMap value
          if (mapKeyToUrl[key]) {
            b.imageUrl = mapKeyToUrl[key];
            b.content = mapKeyToUrl[key];
          }
        }
        return boxes;
      };

      if (finalLayout) {
        replaceInBoxes(finalLayout);
      }
      if (grapesJsonBuilt && Array.isArray(grapesJsonBuilt.layout)) {
        replaceInBoxes(grapesJsonBuilt.layout);
      } else if (grapesJsonBuilt && finalLayout) {
        // embed layout if grapes_json had no layout
        try {
          grapesJsonBuilt.layout = finalLayout;
        } catch (e) {
          console.warn("Failed to embed layout into grapes_json", e);
        }
      }
    } else {
      // Fallback: heuristic replace (fieldName/id contains "qr" or "seal")
      const applyHeuristic = (boxes) => {
        if (!Array.isArray(boxes)) return;
        for (const b of boxes) {
          const name = String(
            b.fieldName || b.name || b.id || ""
          ).toLowerCase();
          if (name.includes("qr") && uploadedUrls.qr) {
            b.imageUrl = uploadedUrls.qr;
            b.content = uploadedUrls.qr;
          }
          if (
            /(seal|stamp|companyseal|logo)/i.test(name) &&
            uploadedUrls.seal
          ) {
            b.imageUrl = uploadedUrls.seal;
            b.content = uploadedUrls.seal;
          }
        }
      };
      if (finalLayout) applyHeuristic(finalLayout);
      if (grapesJsonBuilt && Array.isArray(grapesJsonBuilt.layout))
        applyHeuristic(grapesJsonBuilt.layout);
      else if (grapesJsonBuilt && finalLayout) {
        try {
          grapesJsonBuilt.layout = finalLayout;
        } catch (e) {}
      }
    }

    // --- NEW: attach explicit header/footer/watermark fields into grapes_json and meta.uploads
    try {
      // ensure grapesJsonBuilt is an object
      if (!grapesJsonBuilt || typeof grapesJsonBuilt !== "object") {
        grapesJsonBuilt = { id: `scan-${Date.now()}`, components: [] };
      }

      // If finalLayout exists, ensure grapesJsonBuilt.layout is set (prefer explicit layout)
      if (finalLayout && Array.isArray(finalLayout)) {
        grapesJsonBuilt.layout = finalLayout;
      } else if (!Array.isArray(grapesJsonBuilt.layout)) {
        grapesJsonBuilt.layout = grapesJsonBuilt.layout || [];
      }

      // attach header/footer/watermark explicit URLs to grapes_json
      if (uploadedUrls.header) {
        grapesJsonBuilt.headerUrl = uploadedUrls.header;
      }
      if (uploadedUrls.footer) {
        grapesJsonBuilt.footerUrl = uploadedUrls.footer;
      }
      if (uploadedUrls.watermark) {
        grapesJsonBuilt.watermark = grapesJsonBuilt.watermark || {};
        grapesJsonBuilt.watermark.url = uploadedUrls.watermark;
        // copy placement if we parsed it earlier
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
        // if existingWatermarkUrl was provided by client, keep that too
        grapesJsonBuilt.watermark = grapesJsonBuilt.watermark || {};
        grapesJsonBuilt.watermark.url =
          grapesJsonBuilt.watermark.url || watermarkUrlForGrapes;
      }
    } catch (e) {
      console.warn(
        "uploadScanHandler: failed to attach header/footer/watermark into grapes_json",
        e
      );
    }

    // Build meta object (explicit uploads map so frontend can read deterministically)
    const metaObj = {
      bodyType,
      watermark: !!watermarkName || incomingWatermarkFlag,
      watermarkPlacement: watermarkPlacement || null,
      uploads: {
        header: uploadedUrls.header || null,
        footer: uploadedUrls.footer || null,
        watermark: uploadedUrls.watermark || null,
        qr: uploadedUrls.qr || null,
        seal: uploadedUrls.seal || null,
      },
    };

    const nameFromClient =
      (req.body && req.body.name) ||
      `Uploaded template ${new Date().toISOString()}`;
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

    const saved = await templateService.saveTemplate(
      orgId,
      userId,
      savePayload
    );

    return res.json({ success: true, id: saved.id || saved.insertId || null });
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

    const publicUploads = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "public",
      "uploads"
    );
    await fs.ensureDir(publicUploads);

    const destName = `${Date.now()}_${path
      .basename(file.originalname || file.path)
      .replace(/\s/g, "_")}`;
    const destPath = path.join(publicUploads, destName);

    await fs.ensureDir(path.dirname(destPath));
    await fs.move(file.path, destPath, { overwrite: true });

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

async function serveUploadedFileHandler(req, res) {
  try {
    const { orgId, filename } = req.params;
    const uploadsDir = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "public",
      "uploads"
    );
    const filePath = path.join(uploadsDir, filename);

    const exists = await fs.pathExists(filePath);
    if (!exists) return res.status(404).json({ error: "Not found" });

    return res.sendFile(filePath);
  } catch (err) {
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
  uploadImageHandler,
  saveTemplateHandler,
  listTemplatesHandler,
  serveUploadedFileHandler,
  listBasicTemplatesHandler,
};
