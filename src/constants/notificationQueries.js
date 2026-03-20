const INSERT_NOTIFICATION = `
  INSERT INTO notifications
    (user_id, meeting_id, policy_id, message, triggered_at, is_read, created_at)
  VALUES (?, ?, ?, ?, ?, 0, NOW())
`;

const CHECK_RECENT_SIMILAR_NOTIFICATION = `
  SELECT id FROM notifications
  WHERE user_id = ?
    AND message LIKE ?
    AND is_read = 0
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

const SELECT_POLICIES_ENDING_IN_DAYS = `
  SELECT
    id,
    period,
    DATE_FORMAT(year_start, '%Y-%m-%d') AS year_start,
    DATE_FORMAT(year_end,   '%Y-%m-%d') AS year_end
  FROM leave_policy
  WHERE DATE(year_end) = DATE_ADD(CURDATE(), INTERVAL ? DAY)
`;

const SELECT_NOTIFICATION_RECIPIENTS = `
  SELECT employee_id
  FROM employee_professional
  WHERE LOWER(role) IN ('admin', 'hr', 'manager')
`;

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
const GET_SUPERVISOR = `
  SELECT supervisor_id
  FROM employee_professional
  WHERE employee_id = ?
  LIMIT 1
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
  GET_SUPERVISOR,
};
