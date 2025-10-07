const cron = require("node-cron");
const db = require("../config");
const employeeService = require("../services/employeeService");
const {
  INSERT_NOTIFICATION,
  CHECK_RECENT_SIMILAR_NOTIFICATION,
} = require("../constants/notificationQueries");

const TZ = "Asia/Kolkata";

const REQUIRED_KEYS = [
  // personal
  "first_name",
  "last_name",
  "phone_number",
  "email",
  "dob",
  "gender",
  "emergency_name",
  "emergency_number",
  // government
  "aadhaar_number",
  "aadhaar_doc_url",
  "pan_number",
  "pan_doc_url",
  // education (only main ones - expand as you prefer)
  "tenth_institution",
  "tenth_year",
  "tenth_board",
  "tenth_score",
  "tenth_cert_url",
  "twelfth_institution",
  "twelfth_year",
  "twelfth_board",
  "twelfth_score",
  "twelfth_cert_url",
  // professional
  "resume_url",
  // bank
  "bank_name",
  "account_number",
  "ifsc_code",
  "branch_name",
  // family
  "marital_status",
];

function isMissing(val) {
  if (val === undefined || val === null) return true;
  if (typeof val === "string" && val.trim() === "") return true;
  if (Array.isArray(val) && val.length === 0) return true;
  return false;
}

function labelForKey(key) {
  return key
    .replace(/_url$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

async function runCheckForMissingProfiles({ dedupeDays = 7 } = {}) {
  console.log(
    "[profileMissingNotifier] start scan",
    new Date().toISOString(),
    `(timezone: ${TZ})`
  );

  try {
    // Use 'status' column per your table schema (enum 'Active'|'Inactive')
    const [empRows] = await db.execute(
      `SELECT employee_id FROM employees WHERE status = 'Active'`
    );

    if (!empRows || empRows.length === 0) {
      console.log("[profileMissingNotifier] no active employees found");
      return;
    }

    for (const r of empRows) {
      const employeeId = r.employee_id;
      try {
        const full = await employeeService.getFullEmployee(employeeId);
        const missing = [];
        for (const key of REQUIRED_KEYS) {
          if (isMissing(full[key])) {
            missing.push(labelForKey(key));
          }
        }

        if (missing.length === 0) {
          continue;
        }

        const message = `Your Profile is Incomplete Kindly Update Now`;

        const likeParam = `%${missing[0]}%`;
        const [existRows] = await db.execute(
          CHECK_RECENT_SIMILAR_NOTIFICATION,
          [employeeId, likeParam, dedupeDays]
        );
        if (existRows && existRows.length > 0) {
          console.log(
            `[profileMissingNotifier] skipping ${employeeId} — recent similar notification exists`
          );
          continue;
        }

        await db.execute(INSERT_NOTIFICATION, [
          employeeId,
          null,
          null,
          message,
          new Date(),
        ]);

        console.log(
          `[profileMissingNotifier] inserted notification for ${employeeId}`
        );
      } catch (innerErr) {
        console.error(
          `[profileMissingNotifier] failed for ${employeeId}:`,
          innerErr && innerErr.message ? innerErr.message : innerErr
        );
      }
    }
  } catch (err) {
    console.error("[profileMissingNotifier] job error:", err);
  } finally {
    console.log(
      "[profileMissingNotifier] finished scan",
      new Date().toISOString(),
      `(timezone: ${TZ})`
    );
  }
}

function scheduleJob() {
  cron.schedule(
    "0 9 * * *",
    () => {
      runCheckForMissingProfiles({ dedupeDays: 7 });
    },
    {
      timezone: TZ,
    }
  );
  console.log(`[profileMissingNotifier] scheduled daily @ 09:00 ${TZ}`);
}

module.exports = {
  runCheckForMissingProfiles,
  scheduleJob,
};
