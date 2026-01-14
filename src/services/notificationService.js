const { INSERT_NOTIFICATION } = require("../constants/notificationQueries");
const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");

async function getTenantPoolForOrgId(orgId) {
  if (!orgId) {
    const err = new Error("orgId required to get tenant pool");
    err.code = "ORG_REQUIRED";
    throw err;
  }
  const dbName = sanitizeDbName(`tenant_${orgId}`);
  return getTenantPool(dbName);
}

async function sendMeetingReminder(meeting, orgId) {
  const {
    id: meetingId,
    follow_up_date,
    client_company,
    contact_name,
    created_by: userId,
  } = meeting;

  const resolvedOrgId = orgId || meeting.org_id || meeting.Org_id;
  if (!resolvedOrgId) {
    throw new Error("orgId required to send meeting reminder");
  }

  const message = `Follow up with ${contact_name} at ${client_company}`;
  const triggeredAt = follow_up_date || new Date();

  const tenantPool = await getTenantPoolForOrgId(resolvedOrgId);
  await tenantPool.query(INSERT_NOTIFICATION, [
    userId,
    meetingId,
    null,
    message,
    triggeredAt,
  ]);
}

async function sendAssignmentNotification(meeting, orgId) {
  const {
    assigned_to: userId,
    id: meetingId,
    client_company,
    contact_name,
    org_id: meetingOrgId,
  } = meeting;

  const resolvedOrgId = orgId || meetingOrgId;
  if (!resolvedOrgId) {
    throw new Error("orgId required to send assignment notification");
  }

  const message = `You’ve been assigned follow-up for ${client_company} / ${contact_name}`;
  const triggeredAt = new Date();

  const tenantPool = await getTenantPoolForOrgId(resolvedOrgId);

  await tenantPool.query(INSERT_NOTIFICATION, [
    userId,
    meetingId,
    null,
    message,
    triggeredAt,
  ]);
}

module.exports = { sendMeetingReminder, sendAssignmentNotification };
