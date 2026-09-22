const queries = require("../constants/employeeRequestQueries");
const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");
const assetService = require("./assetsService");

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

function travelBandForRole(role) {
  return [
    "admin",
    "director",
    "manager",
    "hr",
    "finance",
    "traveldesk",
  ].includes(normalizedRole(role))
    ? "UPPER"
    : "LOWER";
}

function validateTravelDetails(details = {}) {
  if (!details.baseLocation || !details.travelLocation) {
    throw new Error("Travel locations are required.");
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

    const annualCtc = Number(employee.salary) || 0;
    const monthlyGrossSalary = annualCtc / 12;

    return {
      monthlyGrossSalary,
      maximumAdvance: monthlyGrossSalary * 3,
    };
  } finally {
    conn.release();
  }
}

async function getTravelContext(orgId, employeeId) {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();

  try {
    const employee = await getEmployeeInfo(conn, employeeId);
    if (!employee) throw new Error("Employee not found");

    return {
      cadreBand: travelBandForRole(employee.role),
      governmentId: employee.aadhaar_number || "",
      mobileNumber: employee.phone_number || "",
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

async function addServiceNotification(
  db,
  {
    userId,
    requestId = null,
    type = "NOTIFICATION",
    title,
    message,
    metadata = null,
  },
) {
  console.log("[EMPLOYEE_SERVICES][NOTIFICATION] Creating notification:", {
    userId,
    requestId,
    type,
    title,
    message,
  });

  if (!userId || !message) {
    console.warn(
      "[EMPLOYEE_SERVICES][NOTIFICATION] Skipping notification because userId or message is missing.",
      {
        userId,
        requestId,
        type,
        message,
      },
    );

    return;
  }

  await db.execute(queries.ADD_SERVICE_NOTIFICATION, [
    requestId,
    userId,
    type,
    title || "Employee Services",
    message,
    metadata ? JSON.stringify(metadata) : null,
  ]);

  console.log(
    "[EMPLOYEE_SERVICES][NOTIFICATION] Notification created successfully.",
    {
      userId,
      requestId,
      type,
    },
  );
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
  attachment = null,
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

    if (String(requestType).toUpperCase() === "TRAVEL_BOOKING") {
      details = validateTravelDetails({
        ...details,
        cadreBand: travelBandForRole(employee.role),
      });
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

    if (attachment) {
      await conn.execute(queries.CREATE_REQUEST_ATTACHMENT, [
        requestId,
        employeeId,
        attachment.originalname,
        attachment.path,
        attachment.mimetype,
        attachment.size,
        "REQUEST_ATTACHMENT",
      ]);
    }

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

    await addServiceNotification(conn, {
      userId: approver.employee_id,
      requestId,
      type: "NOTIFICATION",
      title: "New Employee Service Request",
      message: `New ${title} ${requestCode} is waiting for your action.`,
      metadata: {
        requestCode,
        requestType,
      },
    });

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

async function getAssignedRequestHistory(orgId, employeeId) {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const [rows] = await tenantPool.query(queries.GET_ASSIGNED_REQUEST_HISTORY, [
    orgId,
    employeeId,
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

  const requesterConn = await tenantPool.getConnection();

  let requester = null;

  try {
    requester = await getEmployeeInfo(requesterConn, request.employee_id);
  } finally {
    requesterConn.release();
  }

  const operationalReader = ["traveldesk", "finance", "financeteam"].includes(
    normalizedRole(actor?.role),
  );

  const allowed =
    String(request.employee_id) === String(actorId) ||
    String(request.current_assignee_id) === String(actorId) ||
    String(requester?.supervisor_id) === String(actorId) ||
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

  const [attachments] = await tenantPool.query(
    queries.GET_REQUEST_ATTACHMENTS,
    [requestId],
  );

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

  const publicAttachments = (attachments || []).map((attachment) => ({
    id: attachment.id,
    fileName: attachment.file_name,
    mimeType: attachment.mime_type,
    fileSize: attachment.file_size,
    purpose: attachment.purpose,
  }));

  const eTicket = publicAttachments.find(
    (attachment) => attachment.purpose === "E_TICKET",
  );

  if (eTicket) {
    details = {
      ...details,
      eTicketFileName: eTicket.fileName,
      eTicketAttachmentId: eTicket.id,
    };
  }

  return {
    ...request,
    details_json: details || {},
    attachments: publicAttachments,
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

    const actor = await getEmployeeInfo(conn, actorId);

    if (!actor) {
      throw new Error("Approver not found.");
    }

    const actorRole = normalizedRole(actor.role);

    const isAdminApproval =
      actorRole === "admin" &&
      request.current_status === "PENDING_ADMIN_ACTION" &&
      request.request_type !== "TRAVEL_BOOKING";

    if (
      !isAdminApproval &&
      String(request.current_assignee_id) !== String(actorId)
    ) {
      throw new Error("You are not the current approver for this request.");
    }

    if (isAdminApproval && request.request_type === "ASSET_REQUEST") {
      throw new Error(
        "Use 'Add to Assets and Assign' to process an approved asset request.",
      );
    }

    if (isAdminApproval) {
      await conn.execute(queries.UPDATE_REQUEST_TO_COMPLETED, [requestId]);

      await conn.execute(queries.CLOSE_THREAD_AFTER_COMPLETION, [
        actorId,
        request.thread_id,
      ]);

      await addEvent(
        conn,
        requestId,
        "ADMIN_APPROVED",
        "COMPLETED",
        actorId,
        actor.role,
        comment || "Request approved by Admin.",
      );

      await addServiceNotification(conn, {
        userId: request.employee_id,
        requestId,
        type: "NOTIFICATION",
        title: "Request Approved",
        message: `${request.request_code} was approved by Admin.`,
      });

      await conn.commit();

      if (io) {
        io.to(`user_${request.employee_id}`).emit("employeeRequestUpdated", {
          requestId,
        });
      }

      return getRequestDetail(orgId, requestId, actorId);
    }

    if (request.current_status !== "PENDING_APPROVAL") {
      throw new Error("This request is no longer waiting for approval.");
    }

    const details =
      typeof request.details_json === "string"
        ? JSON.parse(request.details_json || "{}")
        : request.details_json || {};

    if (request.request_type === "SALARY_ADVANCE") {
      const employee = await getEmployeeInfo(conn, request.employee_id);

      const monthlyGrossSalary = (Number(employee?.salary) || 0) / 12;

      const maximumAdvance = monthlyGrossSalary * 3;

      const advanceAmount = Number(details.amount);

      const recoveryMonths = Number(details.repaymentMonths);

      const recoveryStartMonth = String(details.recoveryStartMonth || "");

      if (!monthlyGrossSalary || advanceAmount <= 0) {
        throw new Error("Employee salary or advance amount is invalid.");
      }

      if (advanceAmount > maximumAdvance) {
        throw new Error(
          `Salary advance cannot exceed ₹${maximumAdvance.toLocaleString(
            "en-IN",
          )}.`,
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

    await addServiceNotification(conn, {
      userId: admin.employee_id,
      requestId,
      type: "NOTIFICATION",
      title: "Admin Action Required",
      message: `${request.request_code} requires admin action.`,
    });

    await addServiceNotification(conn, {
      userId: request.employee_id,
      requestId,
      type: "NOTIFICATION",
      title: "Request Approved",
      message: `${request.request_code} has been approved by your supervisor.`,
    });

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

async function getRequestAttachment(orgId, requestId, attachmentId, actorId) {
  // Reuse the detail authorization rules before exposing an on-disk file.
  await getRequestDetail(orgId, requestId, actorId);

  const tenantPool = await getTenantPoolForOrgId(orgId);

  const [rows] = await tenantPool.query(queries.GET_REQUEST_ATTACHMENT, [
    requestId,
    attachmentId,
  ]);

  const attachment = rows?.[0];

  if (!attachment) {
    throw new Error("Attachment not found.");
  }

  return attachment;
}

function parseAssetAssignments(value) {
  if (!value) return [];

  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeAssetStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function parseAssignedTo(assignedTo) {
  console.log("[ASSET_CANDIDATES][assigned_to] Raw value:", assignedTo);

  if (!assignedTo) {
    console.log("[ASSET_CANDIDATES][assigned_to] No assigned_to value.");

    return [];
  }

  try {
    let parsed = assignedTo;

    if (typeof assignedTo === "string") {
      parsed = JSON.parse(assignedTo);
    }

    if (Array.isArray(parsed)) {
      console.log(
        "[ASSET_CANDIDATES][assigned_to] Parsed assignment history:",
        {
          count: parsed.length,
          history: parsed,
        },
      );

      return parsed;
    }

    if (parsed && typeof parsed === "object") {
      console.log(
        "[ASSET_CANDIDATES][assigned_to] assigned_to is a single object. Converting to array.",
      );

      return [parsed];
    }

    console.log(
      "[ASSET_CANDIDATES][assigned_to] Parsed value is not an array/object.",
    );

    return [];
  } catch (error) {
    console.error(
      "[ASSET_CANDIDATES][assigned_to] Failed to parse assigned_to:",
      {
        error: error.message,
        rawValue: assignedTo,
      },
    );

    return null;
  }
}

function getTodayDateString() {
  // Use the organization's/business timezone rather than server UTC.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizeDateOnly(value) {
  if (!value) return null;

  const stringValue = String(value).trim();

  if (!stringValue) return null;

  // Handles:
  // 2026-09-18
  // 2026-09-18T18:30:00.000Z
  return stringValue.slice(0, 10);
}

function assetIsAvailable(asset) {
  console.log("\n------------------------------------------------------");

  console.log("[ASSET_CANDIDATES][Availability] Checking asset:", {
    assetId: asset?.asset_id,
    assetCode: asset?.asset_code,
    assetName: asset?.asset_name,
    category: asset?.category,
    topLevelStatus: asset?.status,
  });

  const assignmentHistory = parseAssignedTo(asset?.assigned_to);

  /*
   * If assigned_to exists but cannot be parsed, do not risk
   * treating an unknown asset as available.
   */
  if (assignmentHistory === null) {
    console.error(
      "[ASSET_CANDIDATES][Availability] assigned_to could not be parsed. Excluding asset.",
      {
        assetId: asset?.asset_id,
      },
    );

    return false;
  }

  /*
   * Remove malformed assignment records that have no useful
   * status information.
   */
  const validHistory = assignmentHistory.filter((entry) => {
    const status = normalizeAssetStatus(entry?.status);

    return ["assigned", "pending", "returned", "decommissioned"].includes(
      status,
    );
  });

  console.log("[ASSET_CANDIDATES][Availability] Valid assignment history:", {
    assetId: asset?.asset_id,
    totalHistoryRecords: assignmentHistory.length,
    validHistoryRecords: validHistory.length,
    history: validHistory,
  });

  /*
   * No usable assignment history means the asset has never been
   * assigned through this field, so it is available.
   */
  if (validHistory.length === 0) {
    console.log(
      "[ASSET_CANDIDATES][Availability] No valid assignment history -> AVAILABLE",
      {
        assetId: asset?.asset_id,
      },
    );

    return true;
  }

  /*
   * IMPORTANT:
   * assigned_to appears to be stored as assignment history in
   * chronological/insertion order.
   *
   * Therefore the LAST valid record represents the current/latest
   * lifecycle state.
   */
  const currentAssignment = validHistory[validHistory.length - 1];

  const currentStatus = normalizeAssetStatus(currentAssignment.status);

  const today = getTodayDateString();

  const returnDate = normalizeDateOnly(currentAssignment.returnDate);

  console.log("[ASSET_CANDIDATES][Availability] Current assignment record:", {
    assetId: asset?.asset_id,
    currentAssignment,
    currentStatus,
    today,
    returnDate,
  });

  /*
   * Returned = definitely available.
   */
  if (currentStatus === "returned") {
    console.log(
      "[ASSET_CANDIDATES][Availability] Current status is RETURNED -> AVAILABLE",
      {
        assetId: asset?.asset_id,
      },
    );

    return true;
  }

  /*
   * Pending = treat as available based on your requirement.
   */
  if (currentStatus === "pending") {
    console.log(
      "[ASSET_CANDIDATES][Availability] Current status is PENDING -> AVAILABLE",
      {
        assetId: asset?.asset_id,
      },
    );

    return true;
  }

  /*
   * Decommissioned assets must never be allocated.
   */
  if (currentStatus === "decommissioned") {
    console.log(
      "[ASSET_CANDIDATES][Availability] Current status is DECOMMISSIONED -> NOT AVAILABLE",
      {
        assetId: asset?.asset_id,
      },
    );

    return false;
  }

  /*
   * Assigned:
   *
   * - No return date -> still assigned
   * - Return date today/future -> still assigned
   * - Return date in past -> assignment has ended, so available
   */
  if (currentStatus === "assigned") {
    if (!returnDate) {
      console.log(
        "[ASSET_CANDIDATES][Availability] ASSIGNED with no returnDate -> NOT AVAILABLE",
        {
          assetId: asset?.asset_id,
          assignedTo: currentAssignment?.name,
          employeeId: currentAssignment?.employeeId,
        },
      );

      return false;
    }

    if (returnDate >= today) {
      console.log(
        "[ASSET_CANDIDATES][Availability] ASSIGNED with current/future returnDate -> NOT AVAILABLE",
        {
          assetId: asset?.asset_id,
          assignedTo: currentAssignment?.name,
          employeeId: currentAssignment?.employeeId,
          returnDate,
          today,
        },
      );

      return false;
    }

    console.log(
      "[ASSET_CANDIDATES][Availability] ASSIGNED record has expired returnDate -> AVAILABLE",
      {
        assetId: asset?.asset_id,
        assignedTo: currentAssignment?.name,
        employeeId: currentAssignment?.employeeId,
        returnDate,
        today,
      },
    );

    return true;
  }

  /*
   * Unknown state -> exclude rather than risk assigning an asset
   * whose lifecycle state cannot be determined.
   */
  console.warn(
    "[ASSET_CANDIDATES][Availability] Unknown assignment state -> NOT AVAILABLE",
    {
      assetId: asset?.asset_id,
      currentAssignment,
      currentStatus,
    },
  );

  return false;
}

async function getAssetCandidates(orgId, requestId, actorId) {
  console.log("\n======================================================");

  console.log("[ASSET_CANDIDATES] getAssetCandidates START");

  console.log("[ASSET_CANDIDATES] Input:", {
    orgId,
    requestId,
    actorId,
  });

  console.log("======================================================");

  console.log("[ASSET_CANDIDATES] Step 1: Getting tenant pool...");

  const tenantPool = await getTenantPoolForOrgId(orgId);

  console.log("[ASSET_CANDIDATES] Step 1 complete: Tenant pool obtained.");

  console.log("[ASSET_CANDIDATES] Step 2: Getting database connection...");

  const conn = await tenantPool.getConnection();

  console.log(
    "[ASSET_CANDIDATES] Step 2 complete: Database connection obtained.",
  );

  try {
    console.log(
      "[ASSET_CANDIDATES] Step 3: Fetching asset request for update...",
      {
        orgId,
        requestId,
      },
    );

    const request = await getRequestForUpdate(conn, orgId, requestId);

    console.log("[ASSET_CANDIDATES] Step 3 complete: Request fetched:", {
      found: !!request,
      requestType: request?.request_type,
      currentAssigneeId: request?.current_assignee_id,
      currentStatus: request?.current_status,
      detailsJson: request?.details_json,
    });

    console.log(
      "[ASSET_CANDIDATES] Step 4: Fetching actor employee information...",
      {
        actorId,
      },
    );

    const actor = await getEmployeeInfo(conn, actorId);

    console.log("[ASSET_CANDIDATES] Step 4 complete: Actor fetched:", {
      found: !!actor,
      actorId: actor?.employee_id || actorId,
      role: actor?.role,
      normalizedRole: normalizedRole(actor?.role),
    });

    console.log("[ASSET_CANDIDATES] Step 5: Validating request type...");

    if (!request || request.request_type !== "ASSET_REQUEST") {
      console.error(
        "[ASSET_CANDIDATES] Validation failed: Invalid asset request.",
        {
          requestExists: !!request,
          requestType: request?.request_type,
        },
      );

      throw new Error("This is not an asset request.");
    }

    console.log(
      "[ASSET_CANDIDATES] Step 5 complete: Request type is ASSET_REQUEST.",
    );

    console.log(
      "[ASSET_CANDIDATES] Step 6: Validating actor authorization...",
      {
        actorRole: actor?.role,
        normalizedActorRole: normalizedRole(actor?.role),
        actorId,
        requestAssigneeId: request.current_assignee_id,
      },
    );

    const actorIsAdmin = normalizedRole(actor?.role) === "admin";

    const actorIsAssigned =
      String(request.current_assignee_id) === String(actorId);

    console.log("[ASSET_CANDIDATES] Authorization checks:", {
      actorIsAdmin,
      actorIsAssigned,
      authorized: actorIsAdmin && actorIsAssigned,
    });

    if (!actorIsAdmin || !actorIsAssigned) {
      console.error(
        "[ASSET_CANDIDATES] Authorization failed: Actor is not the assigned Admin.",
        {
          actorId,
          actorRole: actor?.role,
          requestAssigneeId: request.current_assignee_id,
        },
      );

      throw new Error(
        "Only the assigned Admin can allocate this asset request.",
      );
    }

    console.log("[ASSET_CANDIDATES] Step 6 complete: Actor is authorized.");

    console.log(
      "[ASSET_CANDIDATES] Step 7: Validating request current status...",
      {
        currentStatus: request.current_status,
        expectedStatus: "PENDING_ADMIN_ACTION",
      },
    );

    if (request.current_status !== "PENDING_ADMIN_ACTION") {
      console.error("[ASSET_CANDIDATES] Status validation failed:", {
        currentStatus: request.current_status,
      });

      throw new Error("This asset request is not ready for allocation.");
    }

    console.log(
      "[ASSET_CANDIDATES] Step 7 complete: Request is ready for allocation.",
    );

    console.log("[ASSET_CANDIDATES] Step 8: Parsing request details...");

    const requested =
      typeof request.details_json === "string"
        ? JSON.parse(request.details_json || "{}")
        : request.details_json || {};

    console.log("[ASSET_CANDIDATES] Step 8 complete: Parsed request details:", {
      requested,
    });

    console.log(
      "[ASSET_CANDIDATES] Step 9: Extracting requested asset category...",
    );

    const requestedCategory = String(requested.category || "")
      .trim()
      .toLowerCase();

    console.log("[ASSET_CANDIDATES] Requested category:", {
      originalCategory: requested.category,
      normalizedCategory: requestedCategory,
    });

    if (!requestedCategory) {
      console.error(
        "[ASSET_CANDIDATES] Validation failed: Requested asset category is missing.",
        {
          requested,
        },
      );

      throw new Error(
        "The requested asset category is missing from this request.",
      );
    }

    console.log(
      "[ASSET_CANDIDATES] Step 9 complete: Requested category is valid.",
    );

    console.log(
      "[ASSET_CANDIDATES] Step 10: Fetching all assets for organization...",
      {
        orgId,
      },
    );

    const allAssets = await assetService.getAssets(orgId);

    console.log("[ASSET_CANDIDATES] Step 10 complete: Assets fetched.", {
      totalAssets: Array.isArray(allAssets) ? allAssets.length : 0,
      isArray: Array.isArray(allAssets),
    });

    console.log(
      "[ASSET_CANDIDATES] Step 11: Filtering assets by availability status...",
    );

    const availableAssets = allAssets.filter(assetIsAvailable);

    console.log(
      "[ASSET_CANDIDATES] Step 11 complete: Availability filtering finished.",
      {
        totalAssets: allAssets.length,
        availableAssets: availableAssets.length,
        excludedAssets: allAssets.length - availableAssets.length,
      },
    );

    console.log(
      "[ASSET_CANDIDATES] Step 12: Filtering available assets by category...",
      {
        requestedCategory,
      },
    );

    const categoryMatchedAssets = availableAssets.filter((asset) => {
      const assetCategory = String(asset.category || "")
        .trim()
        .toLowerCase();

      const categoryMatches = assetCategory === requestedCategory;

      console.log("[ASSET_CANDIDATES][CategoryFilter] Asset evaluation:", {
        assetId: asset?.asset_id,
        assetCode: asset?.asset_code,
        assetName: asset?.asset_name,
        rawCategory: asset?.category,
        normalizedCategory: assetCategory,
        requestedCategory,
        categoryMatches,
        status: asset?.status,
      });

      return categoryMatches;
    });

    console.log(
      "[ASSET_CANDIDATES] Step 12 complete: Category filtering finished.",
      {
        requestedCategory,
        categoryMatchedAssets: categoryMatchedAssets.length,
      },
    );

    console.log(
      "[ASSET_CANDIDATES] Step 13: Mapping candidate asset fields...",
    );

    const mappedAssets = categoryMatchedAssets.map((asset) => {
      const mappedAsset = {
        asset_id: asset.asset_id,
        asset_code: asset.asset_code,
        asset_name: asset.asset_name,
        configuration: asset.configuration,
        category: asset.category,
        sub_category: asset.sub_category,
        status: asset.status,
      };

      console.log("[ASSET_CANDIDATES][Map] Asset mapped:", mappedAsset);

      return mappedAsset;
    });

    console.log("[ASSET_CANDIDATES] Step 13 complete: Assets mapped.", {
      mappedCount: mappedAssets.length,
    });

    console.log("[ASSET_CANDIDATES] Step 14: Sorting assets by asset name...");

    const assets = mappedAssets.sort((a, b) =>
      String(a.asset_name || "").localeCompare(String(b.asset_name || "")),
    );

    console.log("[ASSET_CANDIDATES] Step 14 complete: Assets sorted.", {
      sortedAssets: assets.map((asset) => ({
        assetId: asset.asset_id,
        assetCode: asset.asset_code,
        assetName: asset.asset_name,
        category: asset.category,
        status: asset.status,
      })),
    });

    console.log("[ASSET_CANDIDATES] Step 15: Preparing final response...");

    const result = {
      requested,
      requestedCategory: requested.category,
      totalAvailable: assets.length,
      assets,
    };

    console.log("[ASSET_CANDIDATES] Final result:", {
      requestedCategory: result.requestedCategory,
      normalizedRequestedCategory: requestedCategory,
      totalAvailable: result.totalAvailable,
      assetCount: result.assets.length,
      assets: result.assets,
    });

    console.log("\n======================================================");
    console.log("[ASSET_CANDIDATES] getAssetCandidates SUCCESS");
    console.log("======================================================\n");

    return result;
  } catch (error) {
    console.error("\n======================================================");
    console.error("[ASSET_CANDIDATES] getAssetCandidates ERROR");
    console.error("[ASSET_CANDIDATES] Error details:", {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      orgId,
      requestId,
      actorId,
    });
    console.error("======================================================\n");

    throw error;
  } finally {
    console.log(
      "[ASSET_CANDIDATES] Final step: Releasing database connection...",
    );

    conn.release();

    console.log("[ASSET_CANDIDATES] Database connection released.");

    console.log("======================================================");
    console.log("[ASSET_CANDIDATES] getAssetCandidates END");
    console.log("======================================================\n");
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

    await addServiceNotification(conn, {
      userId: request.employee_id,
      requestId,
      type: "NOTIFICATION",
      title: "Request Rejected",
      message: `${request.request_code} was rejected.`,
    });

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

async function saveOrReuseETicketAttachment(
  conn,
  requestId,
  actorId,
  attachment = null,
) {
  const [existingRows] = await conn.execute(
    `
      SELECT id
      FROM employee_request_attachments
      WHERE request_id = ?
        AND purpose = 'E_TICKET'
      ORDER BY id DESC
      LIMIT 1
    `,
    [requestId],
  );

  const existingAttachment = existingRows?.[0] || null;

  // No new file uploaded.
  // Reuse whatever was already saved.
  if (!attachment) {
    return existingAttachment?.id || null;
  }

  /*
   * A new e-ticket was selected.
   *
   * Remove the previous E_TICKET record first so that each request
   * has only one current e-ticket attachment.
   */
  await conn.execute(
    `
      DELETE FROM employee_request_attachments
      WHERE request_id = ?
        AND purpose = 'E_TICKET'
    `,
    [requestId],
  );

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

  return attachmentResult.insertId;
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

    const attachmentId = await saveOrReuseETicketAttachment(
      conn,
      requestId,
      actorId,
      attachment,
    );

    details = {
      ...details,

      transportType: booking.transportType || booking.airline || "",

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
        transportType: booking.transportType || booking.airline || "",
        pnr: booking.pnr || "",
        attachmentId,
      },
    );

    await addServiceNotification(conn, {
      userId: request.employee_id,
      requestId,
      type: "NOTIFICATION",
      title: "Travel Booking Confirmed",
      message: `Your travel request ${request.request_code} has been booked.`,
    });

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

async function saveTravelBookingDraft(
  orgId,
  requestId,
  actorId,
  booking,
  attachment = null,
) {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    const request = await getRequestForUpdate(conn, orgId, requestId);

    if (!request) {
      throw new Error("Request not found");
    }

    if (request.request_type !== "TRAVEL_BOOKING") {
      throw new Error("This is not a travel request.");
    }

    if (request.current_status !== "PENDING_ADMIN_ACTION") {
      throw new Error("This travel request is not available for drafting.");
    }

    const actor = await getEmployeeInfo(conn, actorId);

    const actorRole = normalizedRole(actor?.role);

    if (
      !["admin", "traveldesk", "finance", "financeteam"].includes(actorRole) ||
      (actorRole !== "admin" &&
        String(request.current_assignee_id) !== String(actorId))
    ) {
      throw new Error("You are not allowed to save this booking draft.");
    }

    const details =
      typeof request.details_json === "string"
        ? JSON.parse(request.details_json || "{}")
        : request.details_json || {};

    /*
     * Save the new e-ticket when supplied.
     * Otherwise reuse the existing draft e-ticket.
     */
    const eTicketAttachmentId = await saveOrReuseETicketAttachment(
      conn,
      requestId,
      actorId,
      attachment,
    );

    const nextDetails = {
      ...details,

      transportType: booking.transportType || booking.airline || "",

      pnr: booking.pnr || "",

      departureTime: booking.departureTime || "",

      returnTime: booking.returnTime || "",

      bookingMessage: booking.message || "",

      eTicketAttachmentId: eTicketAttachmentId || null,
    };

    await conn.execute(queries.UPDATE_TRAVEL_BOOKING_DRAFT, [
      JSON.stringify(nextDetails),
      orgId,
      requestId,
    ]);

    await conn.commit();

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

    if (!request) {
      throw new Error("Request not found");
    }

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

    await addServiceNotification(conn, {
      userId: request.current_assignee_id,
      requestId,
      type: "NOTIFICATION",
      title: "Request Cancelled",
      message: `${request.request_code} was cancelled by the employee.`,
    });

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

async function processAssetRequest(
  orgId,
  requestId,
  actorId,
  processing = {},
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
      throw new Error("You are not assigned this request.");
    }

    const actor = await getEmployeeInfo(conn, actorId);

    if (normalizedRole(actor?.role) !== "admin") {
      throw new Error(
        "Only the assigned Admin can allocate this asset request.",
      );
    }

    if (request.request_type !== "ASSET_REQUEST") {
      throw new Error("This is not an asset request.");
    }

    if (request.current_status !== "PENDING_ADMIN_ACTION") {
      throw new Error("This asset request is not ready for processing.");
    }

    const details =
      typeof request.details_json === "string"
        ? JSON.parse(request.details_json || "{}")
        : request.details_json || {};

    const isOffline = processing.offline === true;

    let assignmentMetadata;

    if (isOffline) {
      assignmentMetadata = {
        mode: "OFFLINE",
        note: String(processing.note || "Handled offline by Admin."),
        processedBy: actorId,
        processedAt: new Date().toISOString(),
      };
    } else {
      const assetId = String(processing.assetId || "");

      if (!assetId) {
        throw new Error(
          "Select an available asset or choose offline handling.",
        );
      }

      const requestedCategory = String(details.category || "")
        .trim()
        .toLowerCase();

      if (!requestedCategory) {
        throw new Error(
          "The requested asset category is missing from this request.",
        );
      }

      const assets = await assetService.getAssets(orgId);

      const asset = assets.find((item) => String(item.asset_id) === assetId);

      if (!asset || !assetIsAvailable(asset)) {
        throw new Error("The selected asset is no longer available.");
      }

      const assetCategory = String(asset.category || "")
        .trim()
        .toLowerCase();

      if (assetCategory !== requestedCategory) {
        throw new Error(
          `The selected asset does not belong to the requested category "${details.category}".`,
        );
      }

      const employee = await getEmployeeInfo(conn, request.employee_id);

      await assetService.updateAssignedTo(orgId, asset.asset_id, {
        name: employee?.employee_name || request.employee_id,
        employeeId: request.employee_id,
        startDate: new Date().toISOString().slice(0, 10),
        returnDate: null,
        comments: String(
          processing.note ||
            details.reason ||
            "Assigned from employee asset request.",
        ),
        status: "Assigned",
      });

      assignmentMetadata = {
        mode: "INVENTORY",
        assetId: asset.asset_id,
        assetCode: asset.asset_code,
        assetName: asset.asset_name,
        processedBy: actorId,
        processedAt: new Date().toISOString(),
      };
    }

    const nextDetails = {
      ...details,
      assetFulfillment: assignmentMetadata,
    };

    await conn.execute(queries.UPDATE_REQUEST_TO_COMPLETED_WITH_DETAILS, [
      JSON.stringify(nextDetails),
      requestId,
    ]);

    await conn.execute(queries.CLOSE_THREAD_AFTER_COMPLETION, [
      actorId,
      request.thread_id,
    ]);

    await addEvent(
      conn,
      requestId,
      "ASSET_REGISTERED",
      "COMPLETED",
      actorId,
      "Admin",
      isOffline
        ? "Asset request marked as handled offline."
        : `Existing asset ${assignmentMetadata.assetId} assigned to ${request.employee_id}.`,
      assignmentMetadata,
    );

    await addServiceNotification(conn, {
      userId: request.employee_id,
      requestId,
      type: "NOTIFICATION",
      title: "Asset Request Fulfilled",
      message: isOffline
        ? `${request.request_code} will be handled offline.`
        : `${request.request_code} has been fulfilled with an assigned asset.`,
    });

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

async function sendPendingRequestReminders() {
  const [orgRows] = await require("../config").query(queries.GET_ALL_ORG_IDS);

  let sent = 0;

  for (const { id: orgId } of orgRows || []) {
    const tenantPool = await getTenantPoolForOrgId(orgId);

    const [requests] = await tenantPool.query(queries.GET_REMINDER_REQUESTS, [
      orgId,
    ]);

    for (const request of requests || []) {
      if (!request.current_assignee_id) {
        continue;
      }

      await addServiceNotification(tenantPool, {
        userId: request.current_assignee_id,
        requestId: request.id,
        type: "REMINDER",
        title: "Pending Request Reminder",
        message: `Reminder: ${request.request_code} (${request.title}) is waiting for your action.`,
        metadata: {
          requestCode: request.request_code,
          requestType: request.request_type,
          currentStatus: request.current_status,
          currentStage: request.current_stage,
        },
      });

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

async function getServiceNotifications(orgId, employeeId, limit = 30) {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);

  const [rows] = await tenantPool.query(
    queries.GET_SERVICE_NOTIFICATIONS.replace("LIMIT ?", `LIMIT ${safeLimit}`),
    [employeeId],
  );

  return rows;
}

async function getUnreadServiceCounts(orgId, employeeId) {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const [[notificationCount]] = await tenantPool.query(
    queries.GET_UNREAD_SERVICE_NOTIFICATION_COUNT,
    [employeeId],
  );

  const [[reminderCount]] = await tenantPool.query(
    queries.GET_UNREAD_SERVICE_REMINDER_COUNT,
    [employeeId],
  );

  return {
    notifications: Number(notificationCount?.count || 0),
    reminders: Number(reminderCount?.count || 0),
  };
}

async function getServiceReminders(orgId, employeeId) {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const [rows] = await tenantPool.query(
    queries.GET_SERVICE_REMINDER_REQUESTS_FOR_USER,
    [orgId, employeeId],
  );

  return rows.map((request) => ({
    id: `request-${request.id}`,
    requestId: request.id,
    type: "REMINDER",
    title: request.title,
    message: `${request.request_code} is waiting for your action.`,
    requestCode: request.request_code,
    requestType: request.request_type,
    currentStatus: request.current_status,
    currentStage: request.current_stage,
    updatedAt: request.updated_at,
  }));
}

async function markServiceNotificationRead(orgId, employeeId, notificationId) {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  await tenantPool.execute(queries.MARK_SERVICE_NOTIFICATION_READ, [
    notificationId,
    employeeId,
  ]);

  return {
    success: true,
  };
}

async function markAllServiceNotificationsRead(orgId, employeeId) {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  await tenantPool.execute(queries.MARK_ALL_SERVICE_NOTIFICATIONS_READ, [
    employeeId,
  ]);

  return {
    success: true,
  };
}

async function getEmployeeServiceOverview(orgId, employeeId) {
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const [[overview]] = await tenantPool.query(
    queries.GET_EMPLOYEE_SERVICE_OVERVIEW,
    [employeeId, employeeId, employeeId, employeeId, orgId],
  );

  const counts = await getUnreadServiceCounts(orgId, employeeId);

  return {
    totalRequests: Number(overview?.total_requests || 0),
    myRequests: Number(overview?.my_requests || 0),
    myPending: Number(overview?.my_pending || 0),
    myCompleted: Number(overview?.my_completed || 0),
    assignedPending: Number(overview?.assigned_pending || 0),
    unreadNotifications: counts.notifications,
    unreadReminders: counts.reminders,
  };
}

module.exports = {
  createRequest,
  getRequestsForEmployee,
  getPendingRequests,
  getAssignedRequestHistory,
  getTravelOperations,
  getRequestDetail,
  getRequestAttachment,
  getAssetCandidates,
  approveRequest,
  rejectRequest,
  bookTravel,
  completeRequest,
  cancelRequest,
  sendPendingRequestReminders,
  getGuestHouses,
  getSalaryAdvanceContext,
  getTravelContext,
  saveTravelBookingDraft,
  processAssetRequest,
  getServiceNotifications,
  getUnreadServiceCounts,
  getServiceReminders,
  markServiceNotificationRead,
  markAllServiceNotificationsRead,
  getEmployeeServiceOverview,
};
