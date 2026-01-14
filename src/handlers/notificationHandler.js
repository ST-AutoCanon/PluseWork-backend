const {
  SELECT_UNREAD_NOTIFICATIONS,
  MARK_NOTIFICATION_READ,
} = require("../constants/notificationQueries");
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

const getOrgIdFromHeaders = (req) =>
  req.headers["x-org-id"] ||
  req.headers["org-id"] ||
  req.headers["x_org_id"] ||
  req.query?.orgId ||
  req.body?.orgId ||
  null;

async function getNotifications(req, res) {
  const userId = (req.headers["x-employee-id"] || "").trim();
  const orgId = getOrgIdFromHeaders(req);

  if (!userId || !orgId) {
    return res.status(400).json({
      success: false,
      message: "Missing headers: x-employee-id and x-org-id are required",
    });
  }

  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [rows] = await tenantPool.query(SELECT_UNREAD_NOTIFICATIONS, [
      userId,
    ]);
    return res.json({ success: true, notifications: rows });
  } catch (err) {
    console.error("[notificationHandler] getNotifications error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch notifications." });
  }
}

async function markRead(req, res) {
  const userId = (req.headers["x-employee-id"] || "").trim();
  const orgId = getOrgIdFromHeaders(req);
  const noteId = Number(req.params.id);

  if (!userId || !orgId || !noteId) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid request: ensure x-employee-id, x-org-id, and note id are provided",
    });
  }

  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    await tenantPool.query(MARK_NOTIFICATION_READ, [noteId, userId]);
    return res.json({ success: true });
  } catch (err) {
    console.error("[notificationHandler] markRead error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to mark read." });
  }
}

module.exports = { getNotifications, markRead };
