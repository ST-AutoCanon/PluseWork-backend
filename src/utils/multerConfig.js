// utils/multerConfig.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const FIELD_FOLDERS = {
  photo: "photo",
  aadhaar_doc: "gov",
  pan_doc: "gov",
  passport_doc: "gov",
  driving_license_doc: "gov",
  voter_id_doc: "gov",
  tenth_cert: path.join("edu", "tenth"),
  twelfth_cert: path.join("edu", "twelfth"),
  ug_cert: path.join("edu", "ug"),
  pg_cert: path.join("edu", "pg"),
  resume: "resume",
  other_docs: "other",
  father_gov_doc: "fam",
  mother_gov_doc: "fam",
  spouse_gov_doc: "fam",
  child1_gov_doc: "fam",
  child2_gov_doc: "fam",
  child3_gov_doc: "fam",
};

const BASE_UPLOADS = path.join(__dirname, "../../../EmployeeDetails");

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Extract orgId from possible sources:
 * - req.body.org_id
 * - req.body.orgId
 * - x-org-id header (case-insensitive)
 */
function extractOrgId(req) {
  if (!req) return null;
  const body = req.body || {};
  const maybe =
    body.org_id || body.orgId || body.organization_id || body.organizationId;
  if (maybe) return String(maybe).trim();
  // check header (express normalizes headers to lowercase)
  const headerVal =
    req.get &&
    (req.get("x-org-id") || req.get("x-orgid") || req.get("x-orgId"));
  if (headerVal) return String(headerVal).trim();
  return null;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // require email and orgId to be present (email already required earlier)
    const email =
      (req.body &&
        (req.body.email || req.body.email_address || req.body.emailAddress)) ||
      null;
    const orgId = extractOrgId(req);

    if (!orgId) {
      return cb(
        new Error(
          "Missing orgId: please include org_id/orgId in form-data or x-org-id header"
        ),
        false
      );
    }
    if (!email) {
      return cb(
        new Error("Missing employee email in form-data (field: email)"),
        false
      );
    }

    // sanitize email for folder name (basic)
    const safeEmail = String(email).replace(/[/\\?%*:|"<> ]+/g, "_");

    // handle bracketed fields like experience[0][doc] or additional_certs[1][file]
    const bracketMatch = file.fieldname.match(
      /^(experience|additional_certs)\[(\d+)\]\[(doc|file)\]$/
    );

    let subfolder;
    if (bracketMatch) {
      const [, type, idx] = bracketMatch;
      if (type === "experience") {
        subfolder = path.join("exp", `exp_${idx}`);
      } else {
        // additional_certs
        subfolder = path.join("edu", "additional", `cert_${idx}`);
      }
    } else {
      // fallback to simple mapping
      subfolder = FIELD_FOLDERS[file.fieldname] || "misc";
    }

    // final path: BASE_UPLOADS/<orgId>/<safeEmail>/<subfolder>
    const uploadDir = path.join(
      BASE_UPLOADS,
      String(orgId),
      safeEmail,
      subfolder
    );
    ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },

  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}_${uuidv4()}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/pdf",
    // add more if you want (e.g. doc/docx)
  ]);
  cb(null, allowed.has(file.mimetype));
};

module.exports = multer({ storage, fileFilter }).any();
