const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const {
  addRecruitmentHandler,
  getRecruitmentHandler,
  getRecruitmentByIdHandler,
  getRecruitmentAssessmentsHandler,
  updateRecruitmentHandler,
  advanceRecruitmentHandler,
  deleteRecruitmentHandler,
  assignInterviewHandler,
  technicalFeedbackHandler,
  hrFeedbackHandler,
  managerFeedbackHandler,
  convertToEmployeeHandler,
  parseResumeHandler,
  getRecruitmentInterviewersHandler,
  getOrganizationHandler,
  getPublicOfferResponseHandler,
  submitPublicOfferResponseHandler,
  getRecruitmentLettersHandler,
  createRecruitmentLetterHandler,
  updateRecruitmentLetterHandler,
  sendRecruitmentLetterHandler,
  getPublicOnboardingFormHandler,
  submitPublicOnboardingFormHandler,
  getRecruitmentOnboardingDocumentsHandler,
  downloadRecruitmentOnboardingDocumentHandler,
} = require("../handlers/recruitmentHandler");

const router = express.Router();

const uploadDir = path.join(__dirname, "../../../recruitment");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function sanitizeName(input = "candidate") {
  return input
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-+/g, "-");
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const orgRaw =
      req.headers["x-org-id"] ||
      req.body?.orgId ||
      (req.user && req.user.orgId) ||
      "unknown-org";

    const orgId = path.basename(String(orgRaw));
    const orgDir = path.join(uploadDir, orgId);

    try {
      fs.mkdirSync(orgDir, { recursive: true });
      cb(null, orgDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const baseName =
      req.body?.name ||
      req.body?.email ||
      req.body?.applied_position ||
      "candidate";

    const name = sanitizeName(baseName);
    const ext = path.extname(file.originalname).toLowerCase() || "";
    cb(null, `${name}-${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /pdf|doc|docx/;
  const extName = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimeType =
    file.mimetype === "application/pdf" ||
    file.mimetype === "application/msword" ||
    file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  if (extName && mimeType) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF, DOC, and DOCX files are allowed!"), false);
  }
};

const upload = multer({ storage, fileFilter });

const onboardingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const rawOrgId = String(req.params.orgId || "");

    if (!/^\d+$/.test(rawOrgId)) {
      return cb(new Error("Invalid organisation ID."));
    }

    const safeOrgId = path.basename(rawOrgId);
    const onboardingDir = path.join(uploadDir, safeOrgId, "onboarding");

    try {
      fs.mkdirSync(onboardingDir, { recursive: true });
      cb(null, onboardingDir);
    } catch (error) {
      cb(error);
    }
  },

  filename: (req, file, cb) => {
    const allowedExtensions = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];
    const extension = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      return cb(new Error("Upload PDF or image files only."));
    }

    cb(null, `${crypto.randomBytes(16).toString("hex")}${extension}`);
  },
});

const onboardingUpload = multer({
  storage: onboardingStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 20,
  },
  fileFilter: (req, file, cb) => {
    const validMimeTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!validMimeTypes.includes(file.mimetype)) {
      return cb(new Error("Upload PDF or image files only."));
    }

    cb(null, true);
  },
});

router.post("/recruitment", upload.single("resume"), addRecruitmentHandler);
router.get("/recruitment", getRecruitmentHandler);

router.post(
  "/recruitment/parse-resume",
  upload.single("resume"),
  parseResumeHandler,
);

router.get("/recruitment/interviewers", getRecruitmentInterviewersHandler);

router.get("/recruitment/:id/assessments", getRecruitmentAssessmentsHandler);

router.get("/recruitment/letters", getRecruitmentLettersHandler);

router.post(
  "/recruitment/:id/letters",
  express.json(),
  createRecruitmentLetterHandler,
);

router.put(
  "/recruitment/:id/letters/:letterId",
  express.json(),
  updateRecruitmentLetterHandler,
);

router.post(
  "/recruitment/:id/letters/:letterId/send",
  express.json(),
  sendRecruitmentLetterHandler,
);

router.get(
  "/recruitment/public/onboarding/:orgId/:token",
  getPublicOnboardingFormHandler,
);

router.post(
  "/recruitment/public/onboarding/:orgId/:token",
  onboardingUpload.array("documents", 20),
  submitPublicOnboardingFormHandler,
);

router.get(
  "/recruitment/:id/onboarding-documents",
  getRecruitmentOnboardingDocumentsHandler,
);

router.get(
  "/recruitment/:id/onboarding-documents/:documentId/download",
  downloadRecruitmentOnboardingDocumentHandler,
);

router.get("/recruitment/:id", getRecruitmentByIdHandler);

router.put(
  "/recruitment/:id",
  upload.single("resume"),
  updateRecruitmentHandler,
);

router.post("/recruitment/:id/advance", advanceRecruitmentHandler);
router.post("/recruitment/:id/assign-interview", assignInterviewHandler);

router.delete("/recruitment/:id", deleteRecruitmentHandler);

router.post("/recruitment/:id/technical-feedback", technicalFeedbackHandler);
router.post("/recruitment/:id/hr-feedback", hrFeedbackHandler);
router.post("/recruitment/:id/manager-feedback", managerFeedbackHandler);

router.post("/recruitment/:id/convert-to-employee", convertToEmployeeHandler);

router.get("/organization/:id", getOrganizationHandler);

router.get(
  "/recruitment/public/offer-response/:orgId/:token",
  getPublicOfferResponseHandler,
);

router.post(
  "/recruitment/public/offer-response/:orgId/:token",
  express.json(),
  submitPublicOfferResponseHandler,
);

router.get("/recruitment/files/:orgId/:filename", (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey) {
    return res.status(403).json({ message: "API key is required" });
  }

  const { orgId: orgRaw, filename } = req.params;
  const orgId = path.basename(orgRaw);
  const safeFilename = path.basename(filename);
  const filePath = path.join(uploadDir, orgId, safeFilename);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).json({ message: "File not found" });
    }
    res.sendFile(filePath);
  });
});

module.exports = router;
