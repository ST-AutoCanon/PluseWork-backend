const db = require("../config");
const Q = require("../constants/chatQueries");
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

async function createRoom(orgId, name, isGroup, creatorId, memberIds = []) {
  if (!orgId) throw new Error("orgId required");
  const tenantPool = await getTenantPoolForOrgId(orgId);

  if (!isGroup && Array.isArray(memberIds) && memberIds.length === 1) {
    const otherId = memberIds[0];
    const [existing] = await tenantPool.query(Q.FIND_PRIVATE_ROOM, [
      creatorId,
      otherId,
    ]);
    if (existing && existing.length) {
      return existing[0].room_id;
    }
  }

  const conn = await tenantPool.getConnection();
  try {
    await conn.beginTransaction();
    const [res] = await conn.execute(Q.CREATE_ROOM, [
      name || "",
      isGroup ? 1 : 0,
      creatorId,
    ]);
    const roomId = res.insertId;

    const all = [creatorId, ...(memberIds || [])];
    for (let id of all) {
      await conn.execute(Q.ADD_MEMBER, [roomId, id]);
    }

    await conn.commit();
    return roomId;
  } catch (e) {
    try {
      await conn.rollback();
    } catch (rb) {}
    throw e;
  } finally {
    try {
      conn.release();
    } catch (e) {}
  }
}

async function getUserRooms(orgId, userId) {
  if (!orgId) throw new Error("orgId required");
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(Q.GET_ROOMS_FOR_USER, [userId, userId]);
  return rows;
}

async function saveMessage(
  orgId,
  roomId,
  senderId,
  content,
  type = "text",
  fileUrl = null,
  latitude,
  longitude,
  address
) {
  if (!orgId) throw new Error("orgId required");
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [res] = await tenantPool.execute(Q.SAVE_MESSAGE, [
    roomId,
    senderId,
    content ?? "",
    type ?? "text",
    fileUrl ?? null,
    latitude ?? null,
    longitude ?? null,
    address ?? null,
  ]);
  const newId = res.insertId;
  const [[row]] = await tenantPool.query(Q.GET_MESSAGE_BY_ID, [newId]);
  return row;
}

async function getMessages(orgId, roomId) {
  if (!orgId) throw new Error("orgId required");
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(Q.GET_MESSAGES, [roomId]);
  return rows;
}

async function getRoomMembers(orgId, roomId) {
  if (!orgId) throw new Error("orgId required");
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(Q.GET_ROOM_MEMBERS, [roomId]);
  return rows;
}

async function addMemberToRoom(orgId, roomId, employeeId) {
  if (!orgId) throw new Error("orgId required");
  const tenantPool = await getTenantPoolForOrgId(orgId);
  await tenantPool.execute(Q.ADD_MEMBER_TO_ROOM, [roomId, employeeId]);
}

async function removeMemberFromRoom(orgId, roomId, employeeId) {
  if (!orgId) throw new Error("orgId required");
  const tenantPool = await getTenantPoolForOrgId(orgId);
  await tenantPool.execute(Q.REMOVE_MEMBER_FROM_ROOM, [roomId, employeeId]);
}

async function deleteRoom(orgId, roomId) {
  if (!orgId) throw new Error("orgId required");
  const tenantPool = await getTenantPoolForOrgId(orgId);
  await tenantPool.execute("DELETE FROM chat_rooms WHERE room_id = ?", [
    roomId,
  ]);
}

async function deleteMessage(orgId, messageId, roomId, userId) {
  if (!orgId) throw new Error("orgId required");
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [result] = await tenantPool.execute(Q.DELETE_MESSAGE, [
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

async function markMessagesRead(orgId, roomId, userId) {
  if (!orgId) throw new Error("orgId required");
  const tenantPool = await getTenantPoolForOrgId(orgId);
  await tenantPool.execute(Q.MARK_MESSAGES_READ, [
    userId,
    roomId,
    userId,
    userId,
  ]);
}

async function getMessagesWithRead(orgId, roomId, userId) {
  if (!orgId) throw new Error("orgId required");
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const [rows] = await tenantPool.query(Q.GET_MESSAGES_WITH_READ_STATUS, [
    userId,
    roomId,
  ]);
  return rows;
}

async function getRoomsWithUnreadCounts(orgId, userId) {
  if (!orgId) throw new Error("orgId required");
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const [rooms] = await tenantPool.query(Q.GET_ROOMS_FOR_USER, [
    userId,
    userId,
  ]);
  const [counts] = await tenantPool.query(Q.GET_UNREAD_COUNTS_FOR_USER, [
    userId,
    userId,
    userId,
  ]);
  const byRoom = counts.reduce((acc, { room_id, unreadCount }) => {
    acc[room_id] = unreadCount;
    return acc;
  }, {});
  return rooms.map((r) => ({ ...r, unreadCount: byRoom[r.id] || 0 }));
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
