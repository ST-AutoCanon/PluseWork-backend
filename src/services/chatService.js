const db = require("../config");
const Q = require("../constants/chatQueries");

async function createRoom(name, isGroup, creatorId, memberIds = []) {
  if (!isGroup && memberIds.length === 1) {
    const otherId = memberIds[0];
    const [existing] = await db.execute(Q.FIND_PRIVATE_ROOM, [
      creatorId,
      otherId,
    ]);
    if (existing.length) {
      return existing[0].room_id;
    }
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [res] = await conn.execute(Q.CREATE_ROOM, [
      name || "",
      isGroup ? 1 : 0,
      creatorId,
    ]);
    const roomId = res.insertId;

    const all = [creatorId, ...memberIds];
    for (let id of all) {
      await conn.execute(Q.ADD_MEMBER, [roomId, id]);
    }

    await conn.commit();
    return roomId;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function getUserRooms(userId) {
  const [rows] = await db.execute(Q.GET_ROOMS_FOR_USER, [userId, userId]);
  return rows;
}

async function saveMessage(
  roomId,
  senderId,
  content,
  type = "text",
  fileUrl = null,
  latitude,
  longitude,
  address
) {
  const text = content ?? "";
  const msgType = type ?? "text";
  const fUrl = fileUrl ?? null;

  const [res] = await db.execute(Q.SAVE_MESSAGE, [
    roomId,
    senderId,
    text,
    msgType,
    fUrl,
    latitude,
    longitude,
    address,
  ]);
  const newId = res.insertId;
  const [rows] = await db.execute(Q.GET_MESSAGE_BY_ID, [newId]);
  return rows[0];
}

async function getMessages(roomId) {
  const [rows] = await db.execute(Q.GET_MESSAGES, [roomId]);
  return rows;
}

async function getRoomMembers(roomId) {
  const [rows] = await db.execute(Q.GET_ROOM_MEMBERS, [roomId]);
  return rows;
}

async function addMemberToRoom(roomId, employeeId) {
  await db.execute(Q.ADD_MEMBER_TO_ROOM, [roomId, employeeId]);
}

async function removeMemberFromRoom(roomId, employeeId) {
  await db.execute(Q.REMOVE_MEMBER_FROM_ROOM, [roomId, employeeId]);
}

async function deleteRoom(roomId) {
  await db.execute("DELETE FROM chat_rooms WHERE room_id = ?", [roomId]);
}

async function deleteMessage(messageId, roomId, userId) {
  const [result] = await db.execute(Q.DELETE_MESSAGE, [
    messageId,
    roomId,
    userId,
  ]);
  if (result.affectedRows === 0) {
    const err = new Error("Message not found or not yours");
    err.status = 403;
    throw err;
  }
}

async function markMessagesRead(roomId, userId) {
  await db.execute(Q.MARK_MESSAGES_READ, [userId, roomId, userId, userId]);
}

async function getMessagesWithRead(roomId, userId) {
  const [rows] = await db.execute(Q.GET_MESSAGES_WITH_READ_STATUS, [
    userId,
    roomId,
  ]);
  return rows;
}

async function getRoomsWithUnreadCounts(userId) {
  const [rooms] = await db.execute(Q.GET_ROOMS_FOR_USER, [userId, userId]);
  const [counts] = await db.execute(Q.GET_UNREAD_COUNTS_FOR_USER, [
    userId,
    userId,
    userId,
  ]);
  const byRoom = counts.reduce((acc, { room_id, unreadCount }) => {
    acc[room_id] = unreadCount;
    return acc;
  }, {});
  return rooms.map((r) => ({
    ...r,
    unreadCount: byRoom[r.id] || 0,
  }));
}

module.exports = {
  createRoom,
  getUserRooms,
  saveMessage,
  getMessages,
  getRoomMembers,
  addMemberToRoom,
  removeMemberFromRoom,
  deleteRoom,
  deleteMessage,
  markMessagesRead,
  getMessagesWithRead,
  getRoomsWithUnreadCounts,
};
