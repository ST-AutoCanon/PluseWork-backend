module.exports = {
  CREATE_ROOM: `
    INSERT INTO chat_rooms (room_name, is_group, created_by)
    VALUES (?, ?, ?);
  `,

  GET_ROOMS_FOR_USER: `
  SELECT
    r.room_id                                               AS id,
    ANY_VALUE(r.created_by)                                 AS createdBy,
    ANY_VALUE(
      CASE WHEN r.is_group = 1 THEN r.room_name
           ELSE CONCAT(e2.first_name, ' ', e2.last_name)
      END
    )                                                       AS name,
    ANY_VALUE(
      CASE WHEN r.is_group = 1 THEN NULL
           ELSE p2.photo_url
      END
    )                                                       AS photo_url,
    ANY_VALUE(
      CASE WHEN r.is_group = 1 THEN NULL
           ELSE pr2.role
      END
    )                                                       AS role,
    ANY_VALUE(
      CASE WHEN r.is_group = 1 THEN NULL
           ELSE p2.gender
      END
    )                                                       AS gender,
    ANY_VALUE(r.is_group)                                   AS is_group,
    ANY_VALUE(DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i:%s')) AS created_at
  FROM chat_rooms r
  JOIN room_members m
    ON m.room_id     = r.room_id
   AND m.employee_id = ?
  LEFT JOIN room_members m2
    ON m2.room_id        = r.room_id
   AND m2.employee_id   <> ?
  LEFT JOIN employees e2
    ON e2.employee_id    = m2.employee_id
  LEFT JOIN employee_personal p2
    ON p2.employee_id    = e2.employee_id
  LEFT JOIN employee_professional pr2
    ON pr2.employee_id   = e2.employee_id
  GROUP BY r.room_id
  ORDER BY ANY_VALUE(r.created_at) DESC;
`,

  ADD_MEMBER: `
    INSERT IGNORE INTO room_members (room_id, employee_id)
    VALUES (?, ?);
  `,

  SAVE_MESSAGE: `
    INSERT INTO messages
      (room_id, sender_id, message_text, type, file_url, latitude, longitude, address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
  `,

  GET_MESSAGE_BY_ID: `
    SELECT
      m.message_id    AS id,
      m.room_id       AS roomId,
      m.sender_id     AS senderId,
      CONCAT(e.first_name, ' ', e.last_name) AS senderName,
      p.photo_url     AS photoUrl,
      pr.role         AS senderRole,
      m.message_text  AS content,
      m.type          AS type,
      m.file_url      AS fileUrl,
      DATE_FORMAT(m.created_at, '%Y-%m-%d %H:%i:%s') AS sentAt,
      m.latitude      AS latitude,
      m.longitude     AS longitude,
      m.address       AS address
    FROM messages m
    JOIN employees e
      ON e.employee_id = m.sender_id
    LEFT JOIN employee_personal p
      ON p.employee_id = e.employee_id
    LEFT JOIN employee_professional pr
      ON pr.employee_id = e.employee_id
    WHERE m.message_id = ?;
  `,

  GET_MESSAGES: `
    SELECT
      m.message_id    AS id,
      m.sender_id     AS senderId,
      CONCAT(e.first_name, ' ', e.last_name) AS senderName,
      p.photo_url     AS photoUrl,
      pr.role         AS senderRole,
      m.message_text  AS content,
      m.type          AS type,
      m.file_url      AS fileUrl,
      DATE_FORMAT(m.created_at, '%Y-%m-%d %H:%i:%s') AS sentAt,
      m.latitude      AS latitude,
      m.longitude     AS longitude,
      m.address       AS address
    FROM messages m
    JOIN employees e
      ON e.employee_id = m.sender_id
    LEFT JOIN employee_personal p
      ON p.employee_id = e.employee_id
    LEFT JOIN employee_professional pr
      ON pr.employee_id = e.employee_id
    WHERE m.room_id = ?
    ORDER BY m.created_at ASC;
  `,

  FIND_PRIVATE_ROOM: `
    SELECT r.room_id
    FROM chat_rooms r
    JOIN room_members m1 ON m1.room_id = r.room_id AND m1.employee_id = ?
    JOIN room_members m2 ON m2.room_id = r.room_id AND m2.employee_id = ?
    WHERE r.is_group = 0
    LIMIT 1;
  `,

  GET_ROOM_MEMBERS: `
    SELECT
      e.employee_id           AS employee_id,
      CONCAT(e.first_name, ' ', e.last_name) AS name,
      p.photo_url             AS photo_url,
      pr.role                 AS role,
      p.gender                AS gender,
      rm.joined_at            AS joined_at,
      cr.created_by           AS creatorId
    FROM room_members rm
    JOIN employees e
      ON e.employee_id = rm.employee_id
    LEFT JOIN employee_personal p
      ON p.employee_id = e.employee_id
    LEFT JOIN employee_professional pr
      ON pr.employee_id = e.employee_id
    JOIN chat_rooms cr
      ON cr.room_id = rm.room_id
    WHERE rm.room_id = ?
    ORDER BY rm.joined_at ASC;
  `,

  ADD_MEMBER_TO_ROOM: `
    INSERT IGNORE INTO room_members (room_id, employee_id)
    VALUES (?, ?);
  `,

  REMOVE_MEMBER_FROM_ROOM: `
    DELETE FROM room_members
    WHERE room_id = ? AND employee_id = ?;
  `,

  DELETE_MESSAGE: `
    DELETE FROM messages
    WHERE message_id = ?
      AND room_id    = ?
      AND sender_id  = ?;
  `,

  MARK_MESSAGES_READ: `
    INSERT IGNORE INTO message_reads (message_id, reader_id)
    SELECT
      m.message_id, ?
    FROM messages m
    WHERE m.room_id    = ?
      AND m.sender_id <> ?
      AND NOT EXISTS (
        SELECT 1
        FROM message_reads mr
        WHERE mr.message_id = m.message_id
          AND mr.reader_id  = ?
      );
  `,

  GET_MESSAGES_WITH_READ_STATUS: `
    SELECT
      m.message_id    AS id,
      m.room_id       AS roomId,
      m.sender_id     AS senderId,
      CONCAT(e.first_name, ' ', e.last_name) AS senderName,
      p.photo_url     AS photoUrl,
      pr.role         AS senderRole,
      m.message_text  AS content,
      m.type          AS type,
      m.file_url      AS fileUrl,
      DATE_FORMAT(m.created_at, '%Y-%m-%d %H:%i:%s') AS sentAt,
      m.latitude      AS latitude,
      m.longitude     AS longitude,
      m.address       AS address,
      DATE_FORMAT(mr.read_at, '%Y-%m-%d %H:%i:%s') AS readAt
    FROM messages m
    JOIN employees e
      ON e.employee_id = m.sender_id
    LEFT JOIN employee_personal p
      ON p.employee_id = e.employee_id
    LEFT JOIN employee_professional pr
      ON pr.employee_id = e.employee_id
    LEFT JOIN message_reads mr
      ON mr.message_id = m.message_id
      AND mr.reader_id  = ?
    WHERE m.room_id = ?
    ORDER BY m.created_at ASC;
  `,

  GET_UNREAD_COUNTS_FOR_USER: `
    SELECT
      m.room_id         AS room_id,
      COUNT(*)          AS unreadCount
    FROM messages m
    LEFT JOIN message_reads mr
      ON mr.message_id  = m.message_id
      AND mr.reader_id = ?
    JOIN room_members rm
      ON rm.room_id    = m.room_id
      AND rm.employee_id = ?
    WHERE m.sender_id <> ?
      AND mr.reader_id IS NULL
    GROUP BY m.room_id;
  `,
};
