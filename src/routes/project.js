const express = require("express");
const router = express.Router();
const projectHandler = require("../handlers/projectHandler");
const projectService = require("../services/projectService");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const archiver = require("archiver");

const projectsFolder = path.join(__dirname, "../../../projects");

if (!fs.existsSync(projectsFolder)) {
  fs.mkdirSync(projectsFolder, { recursive: true });
}

function sanitizeName(name = "") {
  return name
    .toString()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_\-\.]/g, "");
}

function getOrgIdFromReq(req) {
  const raw =
    req.headers["x-org-id"] ||
    req.body?.orgId ||
    (req.user && req.user.orgId) ||
    "unknown-org";
  return path.basename(String(raw));
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const orgId = getOrgIdFromReq(req);
    const orgDir = path.join(projectsFolder, orgId);

    try {
      fs.mkdirSync(orgDir, { recursive: true });
      req.body = req.body || {};
      req.body.orgId = orgId;
      cb(null, orgDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: function (req, file, cb) {
    const safeOriginal = sanitizeName(file.originalname);
    cb(null, `${Date.now()}-${safeOriginal}`);
  },
});

const upload = multer({ storage });

function mapFilesToBody(req, res, next) {
  try {
    req.body = req.body || {};
    const orgId = getOrgIdFromReq(req);
    req.body.orgId = orgId;

    if (!req.files || !req.files.length) {
      return next();
    }

    const publicPaths = req.files.map(
      (f) => `/pjattachments/${orgId}/${path.basename(f.filename)}`
    );

    req.body.attachment_url = JSON.stringify(publicPaths);
    req.body._attachment_array = publicPaths;

    next();
  } catch (err) {
    next(err);
  }
}

router.post(
  "/projects",
  upload.array("attachment_url"),
  mapFilesToBody,
  projectHandler.createProject
);

router.put(
  "/projects/:id",
  upload.array("attachment_url"),
  mapFilesToBody,
  projectHandler.updateProject
);

router.get("/projects", projectHandler.getProjects);
router.get("/projects/employeeProjects", projectHandler.getEmployeeProjects);
router.get("/projects/:id", projectHandler.getProjectById);
router.get("/employees", projectHandler.searchEmployees);

router.get("/pjattachments/:orgId/:filename", (req, res) => {
  const { orgId: orgRaw, filename } = req.params;
  const orgId = path.basename(orgRaw);
  const safeFilename = path.basename(filename);
  const filePath = path.join(projectsFolder, orgId, safeFilename);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error("Attachment not found:", filePath, err);
      return res.status(404).send("File not found");
    }
    res.sendFile(filePath, (errSend) => {
      if (errSend) {
        console.error("Error sending file:", errSend);
        res.status(500).send("Error downloading file.");
      }
    });
  });
});

router.get("/projects/:id/attachments/download", async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await projectService.getProjectById(projectId);
    if (!project) {
      return res.status(404).send("Project not found");
    }

    const headerOrg = req.headers["x-org-id"] || req.query.orgId;
    const orgId = headerOrg
      ? path.basename(String(headerOrg))
      : project.orgId
      ? path.basename(String(project.orgId))
      : "unknown-org";

    let attachments = [];
    if (typeof project.attachment_url === "string") {
      try {
        attachments = JSON.parse(project.attachment_url);
      } catch (err) {
        attachments = [project.attachment_url];
      }
    } else if (Array.isArray(project.attachment_url)) {
      attachments = project.attachment_url;
    }

    if (!attachments || !attachments.length) {
      return res.status(404).send("No attachments found for this project.");
    }

    const filesToZip = attachments
      .map((p) => {
        const basename = path.basename(p);
        const filePath = path.join(projectsFolder, orgId, basename);
        return { filePath, nameInZip: basename };
      })
      .filter(({ filePath, nameInZip }) => {
        if (!fs.existsSync(filePath)) {
          console.warn("Attachment missing, skipping:", filePath);
          return false;
        }
        return true;
      });

    if (!filesToZip.length) {
      return res.status(404).send("No existing attachments to download.");
    }

    res.attachment(`project-${projectId}-attachments.zip`);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      throw err;
    });
    archive.pipe(res);

    filesToZip.forEach(({ filePath, nameInZip }) => {
      archive.file(filePath, { name: nameInZip });
    });

    await archive.finalize();
  } catch (error) {
    console.error("Error creating attachments ZIP:", error);
    res.status(500).send("Internal server error");
  }
});

module.exports = router;
