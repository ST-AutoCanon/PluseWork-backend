const db = require("../config");
const queries = require("../constants/empQueryQueries");
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

class EmployeeQueries {
  static async startThread(
    sender_id,
    sender_role,
    department_id,
    subject,
    message,
    recipientRole,
    orgId,
  ) {
    if (!orgId) throw new Error("orgId required");

    const tenantPool = await getTenantPoolForOrgId(orgId);

    let recipient_id;
    if (recipientRole === "Admin") {
      const [admins] = await tenantPool.query(queries.GET_ADMIN, [orgId]);
      if (!admins || admins.length === 0) {
        throw new Error("No admin found for this organization.");
      }
      recipient_id = admins[0].employee_id;
    } else if (recipientRole === "HR") {
      const [hr] = await tenantPool.query(queries.GET_HR, [orgId, orgId]);
      if (!hr || hr.length === 0) {
        throw new Error("No HR manager found for this organization.");
      }
      recipient_id = hr[0].employee_id;
    } else if (recipientRole === "Manager") {
      const [managers] = await tenantPool.query(
        queries.GET_MANAGER_BY_DEPARTMENT,
        [department_id, orgId],
      );
      if (!managers || managers.length === 0) {
        throw new Error(
          "No department manager found for this organization/department.",
        );
      }
      recipient_id = managers[0].employee_id;
    } else {
      throw new Error("Invalid recipient role.");
    }

    const tenantConn = await tenantPool.getConnection();
    try {
      await tenantConn.beginTransaction();

      const [result] = await tenantConn.execute(queries.CREATE_THREAD, [
        orgId,
        sender_id,
        recipient_id,
        subject,
        department_id || null,
        message,
      ]);
      const threadId = result.insertId;

      const [messageResult] = await tenantConn.execute(queries.ADD_MESSAGE, [
        threadId,
        sender_id,
        sender_role,
        message,
        null,
      ]);
      const messageId = messageResult.insertId;

      await EmployeeQueries.markMessageUnreadForRecipientsTenant(
        tenantConn,
        messageId,
        [recipient_id],
      );

      await tenantConn.commit();
      return threadId;
    } catch (err) {
      try {
        await tenantConn.rollback();
      } catch (e) {}
      throw err;
    } finally {
      try {
        tenantConn.release();
      } catch (e) {}
    }
  }

  static async getAdminIdsByEmployee(employeeId) {
    const [orgRows] = await db.execute(queries.GET_ORG_BY_EMPLOYEE, [
      employeeId,
    ]);
    if (!orgRows || orgRows.length === 0) return [];

    const org_id = orgRows[0].org_id;
    if (!org_id) return [];

    const tenantPool = await getTenantPoolForOrgId(org_id);
    const [admins] = await tenantPool.query(queries.GET_ADMIN, [org_id]);
    return admins.map((a) => a.employee_id).filter((id) => id != null);
  }

  static async updateThreadLatestMessageTenant(
    conn,
    thread_id,
    message,
    attachment_url,
  ) {
    let latestMessageValue = "";
    if (message && message.trim().length > 0) {
      latestMessageValue = message;
    } else if (attachment_url) {
      latestMessageValue = "Attachment";
    } else {
      latestMessageValue = "";
    }
    await conn.execute(queries.UPDATE_LATEST_MESSAGE, [
      latestMessageValue,
      thread_id,
    ]);
  }

  static async updateThreadLatestMessage(
    thread_id,
    message,
    attachment_url,
    orgId,
  ) {
    if (!orgId) throw new Error("orgId required");
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const conn = await tenantPool.getConnection();
    try {
      await EmployeeQueries.updateThreadLatestMessageTenant(
        conn,
        thread_id,
        message,
        attachment_url,
      );
    } finally {
      try {
        conn.release();
      } catch (e) {}
    }
  }

  static async addMessage(
    thread_id,
    sender_id,
    sender_role,
    message,
    recipient_id,
    attachment_url = null,
    orgId,
  ) {
    if (!orgId) throw new Error("orgId required");
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const tenantConn = await tenantPool.getConnection();

    try {
      await tenantConn.beginTransaction();

      const [threadRows] = await tenantConn.execute(queries.GET_THREAD_META, [
        thread_id,
      ]);
      const thread = threadRows?.[0];

      if (!thread) {
        throw new Error("Thread not found");
      }

      if (thread.status === "closed") {
        throw new Error("Thread is already closed.");
      }

      const normalizedMessage =
        typeof message === "string" ? message.trim() : "";

      const dbMessage =
        attachment_url && !normalizedMessage ? null : normalizedMessage;

      const [result] = await tenantConn.execute(queries.ADD_MESSAGE, [
        thread_id,
        sender_id,
        sender_role,
        dbMessage,
        attachment_url,
      ]);

      const messageId = result.insertId;

      await EmployeeQueries.updateThreadLatestMessageTenant(
        tenantConn,
        thread_id,
        dbMessage,
        attachment_url,
      );

      await EmployeeQueries.markMessageUnreadForRecipientsTenant(
        tenantConn,
        messageId,
        [recipient_id],
      );

      if (
        String(thread.sender_id) === String(sender_id) &&
        thread.status === "pending_close"
      ) {
        await tenantConn.execute(queries.REOPEN_THREAD, [thread_id]);
      }

      await tenantConn.commit();
      return messageId;
    } catch (err) {
      try {
        await tenantConn.rollback();
      } catch (e) {}
      throw err;
    } finally {
      try {
        tenantConn.release();
      } catch (e) {}
    }
  }

  static async markMessageUnreadForRecipientsTenant(
    conn,
    messageId,
    recipientIds,
  ) {
    if (!Array.isArray(recipientIds) || recipientIds.length === 0) return;
    const values = recipientIds.map((id) => [messageId, id, false]);
    await conn.query(queries.UNREAD_STATUS, [values]);
  }

  static async markMessageUnreadForRecipients(messageId, recipientIds, orgId) {
    if (!orgId) throw new Error("orgId required");
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const conn = await tenantPool.getConnection();
    try {
      await EmployeeQueries.markMessageUnreadForRecipientsTenant(
        conn,
        messageId,
        recipientIds,
      );
    } finally {
      try {
        conn.release();
      } catch (e) {}
    }
  }

  static async markMessagesAsRead(thread_id, sender_id, user_role, orgId) {
    if (!orgId) throw new Error("orgId required");
    const tenantPool = await getTenantPoolForOrgId(orgId);
    if (user_role === "Admin") {
      await tenantPool.query(queries.MARK_MESSAGES_AS_READ_ADMIN, [thread_id]);
    } else {
      await tenantPool.query(queries.MARK_MESSAGES_AS_READ, [
        thread_id,
        sender_id,
      ]);
    }
  }

  static async getThreadMessages(thread_id, orgId) {
    if (!orgId) throw new Error("orgId required");
    const tenantPool = await getTenantPoolForOrgId(orgId);
    try {
      const [rows] = await tenantPool.query(queries.GET_THREAD_MESSAGES, [
        thread_id,
      ]);
      return rows;
    } catch (error) {
      console.error("Error fetching thread messages:", error);
      throw new Error("Database query error.");
    }
  }

  static async closeThread(thread_id, feedback, note = null, orgId) {
    if (!orgId) throw new Error("orgId required");
    const tenantPool = await getTenantPoolForOrgId(orgId);
    await tenantPool.query(queries.CLOSE_THREAD, [feedback, note, thread_id]);
  }

  static async getAllThreads(orgId) {
    if (!orgId) throw new Error("orgId required");
    const tenantPool = await getTenantPoolForOrgId(orgId);
    try {
      const [rows] = await tenantPool.query(queries.GET_ALL_THREADS, [orgId]);
      return rows;
    } catch (error) {
      console.error("Error fetching threads:", error.sqlMessage || error);
      throw new Error(error.message || "Database query error.");
    }
  }

  static async getThreadsByEmployee(employeeId, orgId) {
    if (!orgId) throw new Error("orgId required");
    const tenantPool = await getTenantPoolForOrgId(orgId);
    try {
      const params = [
        employeeId,
        employeeId,
        employeeId,
        employeeId,
        employeeId,
      ];
      const [threads] = await tenantPool.query(queries.FETCH_THREADS, params);
      return threads;
    } catch (error) {
      console.error("Error fetching threads by employee:", error);
      throw new Error("Error fetching threads");
    }
  }

  static async getThreadMeta(thread_id, orgId) {
    if (!orgId) throw new Error("orgId required");
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [rows] = await tenantPool.query(queries.GET_THREAD_META, [thread_id]);
    return rows?.[0] || null;
  }

  static async requestCloseThread(thread_id, actorId, actorRole, orgId) {
    if (!orgId) throw new Error("orgId required");
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const thread = await EmployeeQueries.getThreadMeta(thread_id, orgId);

    if (!thread) throw new Error("Thread not found");
    if (thread.status === "closed") {
      throw new Error("Thread is already closed.");
    }

    const isReceiver = String(thread.recipient_id) === String(actorId);
    const isAdmin = String(actorRole || "").toLowerCase() === "admin";

    if (!isReceiver && !isAdmin) {
      throw new Error("Only the receiver or an admin can request close.");
    }

    await tenantPool.query(queries.REQUEST_CLOSE_THREAD, [actorId, thread_id]);
  }

  static async approveCloseThread(thread_id, actorId, feedback, orgId) {
    if (!orgId) throw new Error("orgId required");
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const thread = await EmployeeQueries.getThreadMeta(thread_id, orgId);

    if (!thread) throw new Error("Thread not found");
    if (String(thread.sender_id) !== String(actorId)) {
      throw new Error("Only the original sender can approve close.");
    }
    if (thread.status !== "pending_close") {
      throw new Error("Thread is not waiting for close approval.");
    }

    await tenantPool.query(queries.APPROVE_CLOSE_THREAD, [
      feedback || null,
      actorId,
      thread_id,
    ]);
  }

  static async reopenThread(thread_id, actorId, orgId) {
    if (!orgId) throw new Error("orgId required");
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const thread = await EmployeeQueries.getThreadMeta(thread_id, orgId);

    if (!thread) throw new Error("Thread not found");
    if (String(thread.sender_id) !== String(actorId)) {
      throw new Error("Only the original sender can reopen.");
    }
    if (thread.status !== "pending_close") {
      return;
    }

    await tenantPool.query(queries.REOPEN_THREAD, [thread_id]);
  }

  static async autoCloseExpiredThreadsForOrg(orgId) {
    if (!orgId) return 0;
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [result] = await tenantPool.query(
      queries.AUTO_CLOSE_EXPIRED_THREADS,
      [orgId],
    );
    return result?.affectedRows || 0;
  }

  static async autoCloseExpiredThreadsAllOrgs() {
    const [orgRows] = await db.execute(queries.GET_ALL_ORG_IDS);
    let total = 0;

    for (const row of orgRows || []) {
      const orgId = row.id;
      if (!orgId) continue;

      try {
        total += await EmployeeQueries.autoCloseExpiredThreadsForOrg(orgId);
      } catch (err) {
        console.error(`[autoCloseExpiredThreadsAllOrgs] orgId=${orgId}`, err);
      }
    }

    return total;
  }
}

module.exports = EmployeeQueries;
