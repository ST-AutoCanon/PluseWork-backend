const cron = require("node-cron");
const db = require("../config");
const {
  INSERT_NOTIFICATION,
  CHECK_RECENT_SIMILAR_NOTIFICATION,
} = require("../constants/notificationQueries");
const {
  GET_ORGS_ENDING_IN_DAYS,
  SELECT_EMPLOYEE_ID_BY_EMAIL,
} = require("../constants/organizationTableQueries");

const TZ = "Asia/Kolkata";

function formatDateToDDMMYYYY(d) {
  if (!d) return "";
  const dt = new Date(d);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

async function runOrgExpiryNotifications({
  daysBefore = 5,
  dedupeDays = 7,
} = {}) {
  try {
    const [orgRows] = await db.execute(GET_ORGS_ENDING_IN_DAYS, [daysBefore]);

    if (!orgRows || orgRows.length === 0) {
      return;
    }

    for (const org of orgRows) {
      try {
        const orgId = org.id;
        const adminEmail = org.admin_email;
        const endDate = org.end_date;

        if (!adminEmail) {
          console.warn(
            `[orgExpiryNotifier] org ${orgId} (${org.Name}) has no admin_email, skipping`
          );
          continue;
        }

        const [empRows] = await db.execute(SELECT_EMPLOYEE_ID_BY_EMAIL, [
          adminEmail,
          orgId,
        ]);
        if (!empRows || empRows.length === 0) {
          console.warn(
            `[orgExpiryNotifier] no active employee found for admin email ${adminEmail} in org ${orgId}`
          );
          continue;
        }
        const employeeId = empRows[0].employee_id;

        const formattedDate = formatDateToDDMMYYYY(endDate);
        const message = `Your subscription to Pulsework is ending on ${formattedDate} kindly contact the Pulsework Administrator to renew your subscription`;

        const likeParam = `%Pulsework is ending on%`;
        const [existRows] = await db.execute(
          CHECK_RECENT_SIMILAR_NOTIFICATION,
          [employeeId, likeParam, dedupeDays]
        );
        if (existRows && existRows.length > 0) {
          continue;
        }

        await db.execute(INSERT_NOTIFICATION, [
          employeeId,
          null,
          null,
          message,
          new Date(),
        ]);
      } catch (innerErr) {
        console.error(
          `[orgExpiryNotifier] failed for org ${org.id}:`,
          innerErr && innerErr.message ? innerErr.message : innerErr
        );
      }
    }
  } catch (err) {
    console.error("[orgExpiryNotifier] job error:", err);
  }
}

function scheduleJob() {
  cron.schedule(
    "22 14 * * *",
    () => {
      runOrgExpiryNotifications({ daysBefore: 5, dedupeDays: 7 }).catch((e) => {
        console.error("[orgExpiryNotifier] run failed:", e);
      });
    },
    { timezone: TZ }
  );
}

module.exports = {
  runOrgExpiryNotifications,
  scheduleJob,
};
