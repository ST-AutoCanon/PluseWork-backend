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

function normalizedRole(role) {
  return String(role || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function validateTravelDetails(details = {}) {
  if (!details.cadreBand || !details.baseLocation || !details.travelLocation) {
    throw new Error("Cadre band and travel locations are required.");
  }

  const distanceKm = Number(details.distanceKm);
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new Error("A valid travel distance is required.");
  }

  const allowedModes =
    String(details.cadreBand).toUpperCase() === "LOWER"
      ? ["Bus", "Train"]
      : ["Airbus", "Train", "Bus"];

  if (!allowedModes.includes(details.transportMode)) {
    throw new Error(
      "The selected transport mode is not eligible for this band.",
    );
  }

  return {
    ...details,
    distanceKm,
    beyondEligibility:
      String(details.cadreBand).toUpperCase() === "LOWER" && distanceKm > 1000,
  };
}

async function getEmployeeInfo(conn, employeeId) {
  const [rows] = await conn.execute(queries.GET_EMPLOYEE_INFO, [employeeId]);

  return rows?.[0] || null;
}

async function getAdmin(conn, orgId) {
  const [rows] = await conn.execute(queries.GET_ADMIN, [orgId]);

  return rows?.[0] || null;
}

async function getEmployeeByRole(conn, role, orgId) {
  const [rows] = await conn.execute(queries.GET_ACTIVE_EMPLOYEE_BY_ROLE, [
    role,
    orgId,
  ]);
  return rows?.[0] || null;
}

async function getEmployeeById(conn, employeeId) {
  const [rows] = await conn.execute(queries.GET_EMPLOYEE_BY_ID, [employeeId]);

  return rows?.[0] || null;
}

async function getSalaryAdvanceContext(orgId, employeeId) {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();

  try {
    const employee = await getEmployeeInfo(conn, employeeId);
    if (!employee) throw new Error("Employee not found");

    const monthlyGrossSalary = Number(employee.salary) || 0;

    return {
      monthlyGrossSalary,
      maximumAdvance: monthlyGrossSalary * 3,
    };
  } finally {
    conn.release();
  }
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
  if (String(requestType).toUpperCase() === "TRAVEL_BOOKING") {
    details = validateTravelDetails(details);
  }

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

async function getTravelOperations(orgId, employeeId) {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();

  try {
    const employee = await getEmployeeInfo(conn, employeeId);
    const role = String(employee?.role || "").toLowerCase();
    if (!["admin", "travel desk", "finance"].includes(role)) {
      throw new Error("Travel operations access is restricted.");
    }
  } finally {
    conn.release();
  }

  const [rows] = await tenantPool.query(queries.GET_TRAVEL_OPERATIONS, [orgId]);
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

  const actorConn = await tenantPool.getConnection();
  let actor = null;
  try {
    actor = await getEmployeeInfo(actorConn, actorId);
  } finally {
    actorConn.release();
  }

  const operationalReader = ["traveldesk", "finance", "financeteam"].includes(
    normalizedRole(actor?.role),
  );

  const allowed =
    String(request.employee_id) === String(actorId) ||
    String(request.current_assignee_id) === String(actorId) ||
    (admin && String(admin.employee_id) === String(actorId)) ||
    (operationalReader && request.request_type === "TRAVEL_BOOKING");

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

    const details =
      typeof request.details_json === "string"
        ? JSON.parse(request.details_json || "{}")
        : request.details_json || {};

    const beyondEligibility =
      request.request_type === "TRAVEL_BOOKING" &&
      details.beyondEligibility === true;

    if (request.request_type === "SALARY_ADVANCE") {
      const employee = await getEmployeeInfo(conn, request.employee_id);
      const monthlyGrossSalary = Number(employee?.salary) || 0;
      const maximumAdvance = monthlyGrossSalary * 3;
      const advanceAmount = Number(details.amount);
      const recoveryMonths = Number(details.repaymentMonths);
      const recoveryStartMonth = String(details.recoveryStartMonth || "");

      if (!monthlyGrossSalary || advanceAmount <= 0) {
        throw new Error("Employee salary or advance amount is invalid.");
      }
      if (advanceAmount > maximumAdvance) {
        throw new Error(
          `Salary advance cannot exceed ₹${maximumAdvance.toLocaleString("en-IN")}.`,
        );
      }
      if (!Number.isInteger(recoveryMonths) || recoveryMonths < 1) {
        throw new Error("Recovery period must be at least one month.");
      }
      if (!/^\d{4}-\d{2}$/.test(recoveryStartMonth)) {
        throw new Error("A valid recovery start month is required.");
      }

      const [startYear, startMonth] = recoveryStartMonth.split("-").map(Number);
      const applicableMonths = Array.from(
        { length: recoveryMonths },
        (_, index) => {
          const month = new Date(startYear, startMonth - 1 + index, 1);
          return `${month.getFullYear()}-${String(
            month.getMonth() + 1,
          ).padStart(2, "0")}`;
        },
      ).join(",");

      await conn.execute(queries.ADD_EMPLOYEE_ADVANCE, [
        request.employee_id,
        advanceAmount,
        recoveryMonths,
        applicableMonths,
      ]);
    }

    if (beyondEligibility && request.current_stage === "SUPERVISOR_APPROVAL") {
      const projectHead = await getEmployeeByRole(conn, "Project Head", orgId);
      if (!projectHead) throw new Error("No active Project Head is available.");

      await conn.execute(queries.UPDATE_REQUEST_ASSIGNEE, [
        "PROJECT_HEAD_APPROVAL",
        projectHead.employee_id,
        projectHead.role,
        requestId,
      ]);
      await conn.execute(queries.UPDATE_THREAD_RECIPIENT, [
        projectHead.employee_id,
        "Reporting Manager approved. Project Head approval is required.",
        request.thread_id,
      ]);
      await addEvent(
        conn,
        requestId,
        "REPORTING_MANAGER_APPROVED",
        "PROJECT_HEAD_APPROVAL",
        actorId,
        actor.role,
        comment || "Approved by Reporting Manager.",
      );
      await addNotification(
        conn,
        projectHead.employee_id,
        `${request.request_code} requires Project Head approval.`,
      );
      await conn.commit();
      if (io)
        io.to(`user_${projectHead.employee_id}`).emit(
          "employeeRequestUpdated",
          { requestId },
        );
      return getRequestDetail(orgId, requestId, actorId);
    }

    if (
      beyondEligibility &&
      request.current_stage === "PROJECT_HEAD_APPROVAL"
    ) {
      const hr = await getEmployeeByRole(conn, "HR", orgId);
      if (!hr) throw new Error("No active HR approver is available.");

      await conn.execute(queries.UPDATE_REQUEST_ASSIGNEE, [
        "HR_FINANCE_APPROVAL",
        hr.employee_id,
        hr.role,
        requestId,
      ]);
      await conn.execute(queries.UPDATE_THREAD_RECIPIENT, [
        hr.employee_id,
        "Project Head approved. HR and Finance approval is required.",
        request.thread_id,
      ]);
      await addEvent(
        conn,
        requestId,
        "PROJECT_HEAD_APPROVED",
        "HR_FINANCE_APPROVAL",
        actorId,
        actor.role,
        comment || "Approved by Project Head.",
      );
      await addNotification(
        conn,
        hr.employee_id,
        `${request.request_code} requires HR and Finance approval.`,
      );
      await conn.commit();
      if (io)
        io.to(`user_${hr.employee_id}`).emit("employeeRequestUpdated", {
          requestId,
        });
      return getRequestDetail(orgId, requestId, actorId);
    }

    if (beyondEligibility && request.current_stage === "HR_FINANCE_APPROVAL") {
      const finance = await getEmployeeByRole(conn, "Finance", orgId);
      if (!finance) throw new Error("No active Finance approver is available.");

      await conn.execute(queries.UPDATE_REQUEST_ASSIGNEE, [
        "FINANCE_APPROVAL",
        finance.employee_id,
        finance.role,
        requestId,
      ]);
      await conn.execute(queries.UPDATE_THREAD_RECIPIENT, [
        finance.employee_id,
        "HR approved. Finance approval is required.",
        request.thread_id,
      ]);
      await addEvent(
        conn,
        requestId,
        "HR_APPROVED",
        "FINANCE_APPROVAL",
        actorId,
        actor.role,
        comment || "Approved by HR.",
      );
      await addNotification(
        conn,
        finance.employee_id,
        `${request.request_code} requires Finance approval.`,
      );
      await conn.commit();
      if (io)
        io.to(`user_${finance.employee_id}`).emit("employeeRequestUpdated", {
          requestId,
        });
      return getRequestDetail(orgId, requestId, actorId);
    }

    if (beyondEligibility && request.current_stage === "FINANCE_APPROVAL") {
      const travelDesk = await getEmployeeByRole(conn, "Travel Desk", orgId);
      if (!travelDesk)
        throw new Error("No active Travel Desk user is available.");

      await conn.execute(queries.UPDATE_REQUEST_ASSIGNEE, [
        "TRAVEL_DESK_ACTION",
        travelDesk.employee_id,
        travelDesk.role,
        requestId,
      ]);
      await conn.execute(queries.UPDATE_THREAD_RECIPIENT, [
        travelDesk.employee_id,
        "Finance approved. Travel Desk action is required.",
        request.thread_id,
      ]);
      await conn.execute(queries.UPDATE_REQUEST_TO_TRAVEL_DESK, [
        travelDesk.employee_id,
        travelDesk.role,
        requestId,
      ]);
      await addEvent(
        conn,
        requestId,
        "FINANCE_APPROVED",
        "TRAVEL_DESK_ACTION",
        actorId,
        actor.role,
        comment || "Approved by Finance.",
      );
      await addNotification(
        conn,
        travelDesk.employee_id,
        `${request.request_code} is ready for Travel Desk action.`,
      );
      await conn.commit();
      if (io)
        io.to(`user_${travelDesk.employee_id}`).emit("employeeRequestUpdated", {
          requestId,
        });
      return getRequestDetail(orgId, requestId, actorId);
    }

    const admin = await getAdmin(conn, orgId);

    if (!admin) throw new Error("No active admin found.");

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

    const actorRole = normalizedRole(actor?.role);
    if (
      !["admin", "traveldesk", "finance", "financeteam"].includes(actorRole)
    ) {
      throw new Error(
        "Only Admin, Travel Desk, or Finance can update travel booking.",
      );
    }

    if (
      actorRole !== "admin" &&
      String(request.current_assignee_id) !== String(actorId)
    ) {
      throw new Error("You can only update travel requests assigned to you.");
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

async function cancelRequest(orgId, requestId, actorId, io = null) {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();
    const request = await getRequestForUpdate(conn, orgId, requestId);

    if (!request) throw new Error("Request not found");
    if (String(request.employee_id) !== String(actorId)) {
      throw new Error("Only the requesting employee can cancel this request.");
    }
    if (
      ["COMPLETED", "REJECTED", "CANCELLED"].includes(request.current_status)
    ) {
      throw new Error("This request can no longer be cancelled.");
    }

    await conn.execute(queries.UPDATE_REQUEST_TO_CANCELLED, [requestId]);
    await conn.execute(queries.CANCEL_THREAD, [
      `Request ${request.request_code} cancelled by employee.`,
      actorId,
      request.thread_id,
    ]);
    await addEvent(
      conn,
      requestId,
      "REQUEST_CANCELLED",
      "COMPLETED",
      actorId,
      "Employee",
      "Request cancelled by employee.",
    );
    await addNotification(
      conn,
      request.current_assignee_id,
      `${request.request_code} was cancelled by the employee.`,
    );
    await conn.commit();

    if (io && request.current_assignee_id) {
      io.to(`user_${request.current_assignee_id}`).emit(
        "employeeRequestUpdated",
        { requestId },
      );
    }
    return getRequestDetail(orgId, requestId, actorId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function sendPendingRequestReminders() {
  const [orgRows] = await require("../config").query(queries.GET_ALL_ORG_IDS);
  let sent = 0;

  for (const { id: orgId } of orgRows || []) {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [requests] = await tenantPool.query(queries.GET_REMINDER_REQUESTS, [
      orgId,
    ]);
    for (const request of requests || []) {
      if (!request.current_assignee_id) continue;
      await tenantPool.execute(queries.ADD_NOTIFICATION, [
        request.current_assignee_id,
        `Reminder: ${request.request_code} (${request.title}) is waiting for your action.`,
      ]);
      sent += 1;
    }
  }
  return sent;
}

const getGuestHouses = async (orgId) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const [rows] = await tenantPool.query(
    `
      SELECT name
      FROM guest_houses
      WHERE org_id = ?
        AND is_active = 1
      ORDER BY name
    `,
    [orgId],
  );

  return rows.map((row) => row.name);
};

module.exports = {
  createRequest,
  getRequestsForEmployee,
  getPendingRequests,
  getTravelOperations,
  getRequestDetail,
  approveRequest,
  rejectRequest,
  bookTravel,
  completeRequest,
  cancelRequest,
  sendPendingRequestReminders,
  getGuestHouses,
  getSalaryAdvanceContext,
};
