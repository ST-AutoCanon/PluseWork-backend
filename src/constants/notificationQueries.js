// backend/constants/notificationQueries.js

const INSERT_NOTIFICATION = `
  INSERT INTO notifications
    (user_id, meeting_id, policy_id, message, triggered_at, is_read, created_at)
  VALUES (?, ?, ?, ?, ?, 0, NOW())
`;

const CHECK_RECENT_SIMILAR_NOTIFICATION = `
  SELECT id FROM notifications
  WHERE user_id = ?
    AND message LIKE ?
    AND triggered_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
  LIMIT 1
`;

const INSERT_NOTIFICATION_FOR_POLICY = `
  INSERT INTO notifications
    (user_id, meeting_id, policy_id, message, triggered_at, created_at)
  VALUES (?, ?, ?, ?, ?, NOW());
`;

const SELECT_UNREAD_NOTIFICATIONS = `
  SELECT
    id,
    meeting_id,
    policy_id,
    message,
    triggered_at
  FROM notifications
  WHERE user_id = ?
    AND is_read = 0
  ORDER BY triggered_at DESC;
`;

/* New helper queries used by the policy-alert job */
const SELECT_POLICIES_ENDING_IN_DAYS = `
  SELECT
    id,
    period,
    DATE_FORMAT(year_start, '%Y-%m-%d') AS year_start,
    DATE_FORMAT(year_end,   '%Y-%m-%d') AS year_end
  FROM leave_policy
  WHERE DATE(year_end) = DATE_ADD(CURDATE(), INTERVAL ? DAY)
`;

/* Choose recipients logic — default: admins/hr/managers.
   Adjust roles if your DB uses different role names. */
const SELECT_NOTIFICATION_RECIPIENTS = `
  SELECT employee_id
  FROM employee_professional
  WHERE LOWER(role) IN ('admin', 'hr', 'manager')
`;

/* Avoid duplicate notifications for same user+policy+message */
const CHECK_NOTIFICATION_EXISTS = `
  SELECT id
  FROM notifications
  WHERE user_id = ? AND policy_id = ? AND message = ?
  LIMIT 1
`;

const MARK_NOTIFICATION_READ = `
  UPDATE notifications
  SET is_read = TRUE
  WHERE id = ?
    AND user_id = ?;
`;

module.exports = {
  INSERT_NOTIFICATION,
  INSERT_NOTIFICATION_FOR_POLICY,
  SELECT_UNREAD_NOTIFICATIONS,
  SELECT_POLICIES_ENDING_IN_DAYS,
  SELECT_NOTIFICATION_RECIPIENTS,
  CHECK_NOTIFICATION_EXISTS,
  MARK_NOTIFICATION_READ,
  CHECK_RECENT_SIMILAR_NOTIFICATION,
};
