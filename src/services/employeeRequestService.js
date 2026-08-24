const queries = require("../constants/employeeRequestQueries");
const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");

async function getTenantPoolForOrgId(orgId) {
  if (!orgId) {
    throw new Error("orgId required");
  }

  const dbName = sanitizeDbName(`tenant_${orgId}`);

  return getTenantPool(dbName);
}

function makeRequestCode(prefix, id) {
  return `${prefix}-${String(id).padStart(6, "0")}`;
}

function requestPrefix(type) {
  switch (String(type).toUpperCase()) {
    case "TRAVEL_BOOKING":
      return "TRV";

    case "SALARY_ADVANCE":
      return "SAL";

    case "SUPPORTING_DOCUMENT":
      return "DOC";

    case "ASSET_REQUEST":
      return "AST";

    default:
      return "REQ";
  }
}

async function getEmployeeInfo(conn, employeeId) {
  const [rows] = await conn.execute(queries.GET_EMPLOYEE_INFO, [employeeId]);

  return rows?.[0] || null;
}

async function getAdmin(conn, orgId) {
  const [rows] = await conn.execute(queries.GET_ADMIN, [orgId]);

  return rows?.[0] || null;
}

async function getEmployeeById(conn, employeeId) {
  const [rows] = await conn.execute(queries.GET_EMPLOYEE_BY_ID, [employeeId]);

  return rows?.[0] || null;
}

async function getNextApprover(conn, employee, orgId) {
  if (employee.supervisor_id) {
    const supervisor = await getEmployeeById(conn, employee.supervisor_id);

    if (
      supervisor &&
      String(supervisor.employee_id) !== String(employee.employee_id)
    ) {
      return supervisor;
    }
  }

  return getAdmin(conn, orgId);
}

async function addEvent(
  conn,
  requestId,
  eventType,
  stage,
  actorId,
  actorRole,
  message,
  metadata = null,
) {
  await conn.execute(queries.ADD_REQUEST_EVENT, [
    requestId,
    eventType,
    stage,
    actorId || null,
    actorRole || null,
    message || null,
    metadata ? JSON.stringify(metadata) : null,
  ]);
}

async function addNotification(conn, userId, message) {
  if (!userId) return;

  await conn.execute(queries.ADD_NOTIFICATION, [userId, message]);
}

async function createThread(
  conn,
  orgId,
  employeeId,
  recipientId,
  departmentId,
  subject,
  firstMessage,
  employeeRole,
) {
  const [threadResult] = await conn.execute(queries.CREATE_THREAD, [
    orgId,
    employeeId,
    recipientId,
    departmentId || null,
    subject,
    firstMessage,
  ]);

  const threadId = threadResult.insertId;

  const [messageResult] = await conn.execute(queries.CREATE_THREAD_MESSAGE, [
    threadId,
    employeeId,
    employeeRole || "Employee",
    firstMessage,
  ]);

  await conn.execute(queries.CREATE_MESSAGE_READ_STATUS, [
    messageResult.insertId,
    recipientId,
  ]);

  return threadId;
}

async function createRequest({
  orgId,
  employeeId,
  requestType,
  title,
  details,
}) {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    const employee = await getEmployeeInfo(conn, employeeId);

    if (!employee) {
      throw new Error("Employee not found");
    }

    if (employee.status !== "Active") {
      throw new Error("Employee is inactive");
    }

    const approver = await getNextApprover(conn, employee, orgId);

    if (!approver) {
      throw new Error("No supervisor or admin is available for this request.");
    }

    const isAdminApprover =
      String(approver.role || "").toLowerCase() === "admin";

    const currentStatus = isAdminApprover
      ? "PENDING_ADMIN_ACTION"
      : "PENDING_APPROVAL";

    const currentStage = isAdminApprover
      ? "ADMIN_ACTION"
      : "SUPERVISOR_APPROVAL";

    const firstMessage = `New ${title} submitted.`;

    const threadId = await createThread(
      conn,
      orgId,
      employeeId,
      approver.employee_id,
      employee.department_id,
      title,
      firstMessage,
      employee.role,
    );

    const [result] = await conn.execute(queries.CREATE_EMPLOYEE_REQUEST, [
      orgId,
      employeeId,
      requestType,
      title,
      threadId,
      currentStatus,
      currentStage,
      approver.employee_id,
      approver.role,
      JSON.stringify(details || {}),
    ]);

    const requestId = result.insertId;

    const requestCode = makeRequestCode(requestPrefix(requestType), requestId);

    await conn.execute(queries.UPDATE_REQUEST_CODE, [requestCode, requestId]);

    const submittedEvent = isAdminApprover ? "SUBMITTED" : "SUBMITTED";

    await addEvent(
      conn,
      requestId,
      submittedEvent,
      currentStage,
      employeeId,
      employee.role || "Employee",
      "Request submitted successfully.",
      {
        requestCode,
      },
    );

    await addNotification(
      conn,
      approver.employee_id,
      `New ${title} ${requestCode} is waiting for your action.`,
    );

    await conn.commit();

    return {
      id: requestId,
      requestCode,
      threadId,
      currentStatus,
      currentStage,
      currentAssigneeId: approver.employee_id,
      currentAssigneeRole: approver.role,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function getRequestsForEmployee(orgId, employeeId) {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const [rows] = await tenantPool.query(queries.GET_REQUESTS_FOR_EMPLOYEE, [
    orgId,
    employeeId,
  ]);

  return rows;
}

async function getPendingRequests(orgId, employeeId) {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const [rows] = await tenantPool.query(queries.GET_PENDING_REQUESTS, [
    orgId,
    employeeId,
  ]);

  return rows;
}

async function getRequestForUpdate(conn, orgId, requestId) {
  const [rows] = await conn.execute(queries.GET_REQUEST_FOR_UPDATE, [
    orgId,
    requestId,
  ]);

  return rows?.[0] || null;
}

async function getRequestDetail(orgId, requestId, actorId) {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const [rows] = await tenantPool.query(queries.GET_REQUEST_DETAIL, [
    orgId,
    requestId,
  ]);

  const request = rows?.[0];

  if (!request) {
    throw new Error("Request not found");
  }

  const adminConn = await tenantPool.getConnection();

  let admin;

  try {
    admin = await getAdmin(adminConn, orgId);
  } finally {
    adminConn.release();
  }

  const allowed =
    String(request.employee_id) === String(actorId) ||
    String(request.current_assignee_id) === String(actorId) ||
    (admin && String(admin.employee_id) === String(actorId));

  if (!allowed) {
    const conn = await tenantPool.getConnection();

    try {
      const actor = await getEmployeeInfo(conn, actorId);

      if (!actor || String(actor.role || "").toLowerCase() !== "admin") {
        throw new Error("You do not have access to this request.");
      }
    } finally {
      conn.release();
    }
  }

  const [events] = await tenantPool.query(queries.GET_REQUEST_EVENTS, [
    requestId,
  ]);

  const [messages] = await tenantPool.query(queries.GET_THREAD_MESSAGES, [
    request.thread_id,
  ]);

  let details = {};

  if (request.details_json) {
    if (typeof request.details_json === "string") {
      try {
        details = JSON.parse(request.details_json);
      } catch {
        details = {};
      }
    } else {
      details = request.details_json;
    }
  }

  if (request.e_ticket_file_name) {
    details = {
      ...details,
      eTicketFileName: request.e_ticket_file_name,
    };
  }

  return {
    ...request,
    details_json: details || {},
    events,
    messages,
  };
}

async function approveRequest(
  orgId,
  requestId,
  actorId,
  comment = "",
  io = null,
) {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    const request = await getRequestForUpdate(conn, orgId, requestId);

    if (!request) {
      throw new Error("Request not found");
    }

    if (String(request.current_assignee_id) !== String(actorId)) {
      throw new Error("You are not the current approver for this request.");
    }

    if (request.current_status !== "PENDING_APPROVAL") {
      throw new Error("This request is no longer waiting for approval.");
    }

    const actor = await getEmployeeInfo(conn, actorId);

    if (!actor) {
      throw new Error("Approver not found.");
    }

    const admin = await getAdmin(conn, orgId);

    if (!admin) {
      throw new Error("No active admin found.");
    }

    await conn.execute(queries.UPDATE_REQUEST_TO_ADMIN_ACTION, [
      admin.employee_id,
      requestId,
    ]);

    await conn.execute(queries.UPDATE_THREAD_RECIPIENT, [
      admin.employee_id,
      "Request approved by supervisor. Waiting for admin action.",
      request.thread_id,
    ]);

    await addEvent(
      conn,
      requestId,
      "SUPERVISOR_APPROVED",
      "ADMIN_ACTION",
      actorId,
      actor.role,
      comment || "Approved by supervisor.",
    );

    await addNotification(
      conn,
      admin.employee_id,
      `${request.request_code} requires admin action.`,
    );

    await addNotification(
      conn,
      request.employee_id,
      `${request.request_code} has been approved by your supervisor.`,
    );

    await conn.commit();

    if (io) {
      io.to(`user_${admin.employee_id}`).emit("employeeRequestUpdated", {
        requestId,
      });

      io.to(`user_${request.employee_id}`).emit("employeeRequestUpdated", {
        requestId,
      });
    }

    return getRequestDetail(orgId, requestId, actorId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function rejectRequest(
  orgId,
  requestId,
  actorId,
  comment = "",
  io = null,
) {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    const request = await getRequestForUpdate(conn, orgId, requestId);

    if (!request) {
      throw new Error("Request not found");
    }

    if (String(request.current_assignee_id) !== String(actorId)) {
      throw new Error("You are not allowed to reject this request.");
    }

    const actor = await getEmployeeInfo(conn, actorId);

    await conn.execute(queries.UPDATE_REQUEST_TO_REJECTED, [requestId]);

    const rejectionMessage = `Request rejected: ${
      comment || "No reason provided."
    }`;

    await conn.execute(queries.CLOSE_THREAD_AFTER_REJECTION, [
      rejectionMessage,
      actorId,
      request.thread_id,
    ]);

    await addEvent(
      conn,
      requestId,
      "REQUEST_REJECTED",
      "COMPLETED",
      actorId,
      actor?.role || null,
      comment || "Request rejected.",
    );

    await addNotification(
      conn,
      request.employee_id,
      `${request.request_code} was rejected.`,
    );

    await conn.commit();

    if (io) {
      io.to(`user_${request.employee_id}`).emit("employeeRequestUpdated", {
        requestId,
      });
    }

    return getRequestDetail(orgId, requestId, actorId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function bookTravel(
  orgId,
  requestId,
  actorId,
  booking,
  attachment,
  io = null,
) {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    const request = await getRequestForUpdate(conn, orgId, requestId);

    if (!request) {
      throw new Error("Request not found");
    }

    const actor = await getEmployeeInfo(conn, actorId);

    if (String(actor?.role || "").toLowerCase() !== "admin") {
      throw new Error("Only an Admin can complete travel booking.");
    }

    if (request.request_type !== "TRAVEL_BOOKING") {
      throw new Error("This is not a travel request.");
    }

    if (request.current_status !== "PENDING_ADMIN_ACTION") {
      throw new Error("This travel request is not ready for booking.");
    }

    let details =
      typeof request.details_json === "string"
        ? JSON.parse(request.details_json || "{}")
        : request.details_json || {};

    let attachmentId = null;

    if (attachment) {
      const [attachmentResult] = await conn.execute(
        queries.CREATE_REQUEST_ATTACHMENT,
        [
          requestId,
          actorId,
          attachment.originalname,
          attachment.path,
          attachment.mimetype,
          attachment.size,
          "E_TICKET",
        ],
      );

      attachmentId = attachmentResult.insertId;
    }

    details = {
      ...details,

      airline: booking.airline || "",

      pnr: booking.pnr || "",

      departureTime: booking.departureTime || "",

      returnTime: booking.returnTime || "",

      bookedBy: actorId,

      bookedByName: actor.employee_name,

      bookedOn: new Date().toISOString(),

      eTicketAttachmentId: attachmentId,
    };

    await conn.execute(queries.UPDATE_REQUEST_TO_BOOKED, [
      JSON.stringify(details),
      requestId,
    ]);

    await conn.execute(queries.UPDATE_THREAD_AFTER_BOOKING, [
      request.thread_id,
    ]);

    await addEvent(
      conn,
      requestId,
      "BOOKING_CONFIRMED",
      "EMPLOYEE_CONFIRMATION",
      actorId,
      actor.role,
      "Travel tickets booked and e-ticket shared.",
      {
        airline: booking.airline || "",
        pnr: booking.pnr || "",
        attachmentId,
      },
    );

    await addNotification(
      conn,
      request.employee_id,
      `Your travel request ${request.request_code} has been booked.`,
    );

    await conn.commit();

    if (io) {
      io.to(`user_${request.employee_id}`).emit("employeeRequestUpdated", {
        requestId,
      });
    }

    return getRequestDetail(orgId, requestId, actorId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function completeRequest(
  orgId,
  requestId,
  actorId,
  comment = "",
  io = null,
) {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    const request = await getRequestForUpdate(conn, orgId, requestId);

    if (!request) {
      throw new Error("Request not found");
    }

    if (String(request.employee_id) !== String(actorId)) {
      throw new Error(
        "Only the requesting employee can complete this request.",
      );
    }

    if (request.current_status !== "BOOKED") {
      throw new Error("This request cannot be completed yet.");
    }

    await conn.execute(queries.UPDATE_REQUEST_TO_COMPLETED, [requestId]);

    await conn.execute(queries.CLOSE_THREAD_AFTER_COMPLETION, [
      actorId,
      request.thread_id,
    ]);

    await addEvent(
      conn,
      requestId,
      "TRIP_COMPLETED",
      "COMPLETED",
      actorId,
      "Employee",
      comment || "Employee confirmed trip completion.",
    );

    await conn.commit();

    if (io) {
      io.to(`user_${actorId}`).emit("employeeRequestUpdated", {
        requestId,
      });
    }

    return getRequestDetail(orgId, requestId, actorId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = {
  createRequest,
  getRequestsForEmployee,
  getPendingRequests,
  getRequestDetail,
  approveRequest,
  rejectRequest,
  bookTravel,
  completeRequest,
};
