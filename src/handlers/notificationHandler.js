const db = require("../config");
const {
  SELECT_UNREAD_NOTIFICATIONS,
  MARK_NOTIFICATION_READ,
} = require("../constants/notificationQueries");

async function getNotifications(req, res) {
  const userId = (req.headers["x-employee-id"] || "").trim();
  if (!userId) {
    return res
      .status(400)
      .json({ success: false, message: "Missing user header" });
  }

  try {
    const [rows] = await db.execute(SELECT_UNREAD_NOTIFICATIONS, [userId]);
    res.json({ success: true, notifications: rows });
  } catch (err) {
    console.error("[notificationHandler] getNotifications error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch notifications." });
  }
}

async function markRead(req, res) {
  const userId = (req.headers["x-employee-id"] || "").trim();
  const noteId = parseInt(req.params.id, 10);
  if (!userId || !noteId) {
    return res.status(400).json({ success: false, message: "Invalid request" });
  }

  try {
    await db.execute(MARK_NOTIFICATION_READ, [noteId, userId]);
    res.json({ success: true });
  } catch (err) {
    console.error("[notificationHandler] markRead error:", err);
    res.status(500).json({ success: false, message: "Failed to mark read." });
  }
}

module.exports = { getNotifications, markRead };
