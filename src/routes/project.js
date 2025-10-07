const express = require("express");
const router = express.Router();
const projectHandler = require("../handlers/projectHandler");
const projectService = require("../services/projectService");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const archiver = require("archiver");

// Path to projects folder
const projectsFolder = path.join(__dirname, "../../../projects");

// Ensure the folder exists
if (!fs.existsSync(projectsFolder)) {
  fs.mkdirSync(projectsFolder, { recursive: true });
  console.log(`Created folder: ${projectsFolder}`);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, projectsFolder);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// Routes
router.post(
  "/projects",
  upload.array("attachment_url"),
  projectHandler.createProject
);
router.get("/projects", projectHandler.getProjects);
router.get("/projects/employeeProjects", projectHandler.getEmployeeProjects);
router.get("/projects/:id", projectHandler.getProjectById);
router.put(
  "/projects/:id",
  upload.array("attachment_url"),
  projectHandler.updateProject
);
router.get("/employees", projectHandler.searchEmployees);

router.get("/pjattachments/:filename", (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(projectsFolder, filename);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Error sending file:", err);
      res.status(500).send("Error downloading file.");
    }
  });
});

router.get("/projects/:id/attachments/download", async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await projectService.getProjectById(projectId);
    if (!project) {
      return res.status(404).send("Project not found");
    }

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

    if (!attachments.length) {
      return res.status(404).send("No attachments found for this project.");
    }

    res.attachment(`project-${projectId}-attachments.zip`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      throw err;
    });
    archive.pipe(res);

    attachments.forEach((fileName) => {
      const filePath = path.join(projectsFolder, fileName);
      archive.file(filePath, { name: fileName });
    });

    await archive.finalize();
  } catch (error) {
    console.error("Error creating attachments ZIP:", error);
    res.status(500).send("Internal server error");
  }
});

module.exports = router;
