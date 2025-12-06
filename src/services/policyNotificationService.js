const db = require("../config");
const {
  SELECT_POLICIES_ENDING_IN_DAYS,
  SELECT_NOTIFICATION_RECIPIENTS,
  CHECK_NOTIFICATION_EXISTS,
  INSERT_NOTIFICATION_FOR_POLICY,
} = require("../constants/notificationQueries");

async function sendPolicyEndNotifications(daysBefore = 10) {
  if (!Number.isInteger(daysBefore)) daysBefore = Number(daysBefore);

  const [policies] = await db.execute(SELECT_POLICIES_ENDING_IN_DAYS, [
    daysBefore,
  ]);
  if (!Array.isArray(policies) || policies.length === 0) return 0;

  const [recipients] = await db.execute(SELECT_NOTIFICATION_RECIPIENTS);

  let createdCount = 0;

  for (const policy of policies) {
    const message = `Policy period ${policy.year_start} — ${
      policy.year_end
    } ends in ${daysBefore} day${daysBefore !== 1 ? "s" : ""}.`;
    const triggeredAt = new Date();

    for (const r of recipients) {
      const userId = String(r.employee_id).trim();
      const [existsRows] = await db.execute(CHECK_NOTIFICATION_EXISTS, [
        userId,
        policy.id,
        message,
      ]);
      if (Array.isArray(existsRows) && existsRows.length > 0) {
        continue;
      }

      await db.execute(INSERT_NOTIFICATION_FOR_POLICY, [
        userId,
        null,
        policy.id,
        message,
        triggeredAt,
      ]);
      createdCount++;
    }
  }

  return createdCount;
}

module.exports = { sendPolicyEndNotifications };
