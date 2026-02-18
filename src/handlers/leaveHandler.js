const fs = require("fs");
const path = require("path");
const LeaveService = require("../services/leaveService");
const ErrorHandler = require("../utils/errorHandler");
let tenantPoolManager = null;
try {
  tenantPoolManager = require("../db/tenantPoolManager");
} catch (e) {
  tenantPoolManager = null;
}

const parseBoolFlexible = (v) => {
  if (v === undefined || v === null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    return ["1", "true", "yes", "y", "on"].includes(t);
  }
  return false;
};
const resolveOrgId = (req) =>
  req.orgId ||
  req.headers?.["x-org-id"] ||
  req.headers?.["x_org_id"] ||
  req.query?.orgId ||
  req.query?.org_id ||
  req.body?.orgId ||
  req.body?.org_id ||
  (req.user && (req.user.orgId || req.user.org_id)) ||
  null;

// Helper: build public-facing attachment shape (adds url & exists)
function buildPublicAttachment(a, orgId, req) {
  const id = a.id || a.attachment_id || a.attachmentId || null;
  const file_name =
    a.file_name || a.name || a.originalname || a.fileName || null;
  const rawPath = a.file_path || a.path || a.filePath || a.file || "";

  let file_path = rawPath;
  // Keep file_path as originally stored if absolute; otherwise keep the raw value
  if (!file_path) file_path = null;

  // compute absolute path for exists check
  let abs = file_path || "";
  try {
    if (abs && !path.isAbsolute(abs)) {
      // If path looks like "uploads/..." or "/uploads/..." try to resolve relative to project
      abs = path.join(process.cwd(), abs);
    }
  } catch (e) {
    abs = file_path || "";
  }

  let exists = false;
  try {
    if (abs) exists = fs.existsSync(abs);
  } catch (_) {
    exists = false;
  }

  // Build base host/proto
  const forwardedProto =
    (req && req.headers && req.headers["x-forwarded-proto"]) || null;
  const protocol =
    (forwardedProto && String(forwardedProto).split(",")[0]) ||
    (req && req.protocol) ||
    "https";
  const host =
    (req && typeof req.get === "function" && req.get("host")) ||
    process.env.PUBLIC_HOST ||
    null;
  const hostPart = host ? host.replace(/:\/\/$/, "") : host;

  // Try to build useful urls in order of preference:
  // 1) if an explicit url exists on record, use it
  // 2) prefer a backend-served attachment route if we have an id
  // 3) derive URL from an uploads path ("/uploads/") if present

  let url = a.url || a.file_url || null;

  if (!url && id && host) {
    // prefer the simple attachments route which this handler provides (ensure your routes mount this)
    try {
      const base = `${protocol}://${hostPart}`;
      url = `${base.replace(/\/$/, "")}/attachments/${encodeURIComponent(id)}?orgId=${encodeURIComponent(orgId)}`;
    } catch (e) {
      url = null;
    }
  }

  if (!url && file_path && typeof file_path === "string") {
    const uploadsIndex = String(file_path).indexOf("/uploads/");
    if (uploadsIndex !== -1 && host) {
      const publicPath = file_path.slice(uploadsIndex);
      const base = `${protocol}://${hostPart}`;
      url = `${base.replace(/\/$/, "")}${publicPath}`;
    }
  }

  return {
    id,
    file_name,
    file_path: file_path || null,
    mime_type: a.mime_type || a.mimetype || a.type || null,
    size: a.size || a.file_size || null,
    created_at: a.created_at || a.createdAt || null,
    url: url || null,
    exists: Boolean(exists),
    // keep original raw object for debugging if needed
    _raw: a,
  };
}

class LeaveHandler {
  static async getLeaveTypesHandler(req, res) {
    try {
      const orgId =
        req.orgId ||
        req.headers?.["x-org-id"] ||
        req.headers?.["x_org_id"] ||
        req.headers?.["org-id"] ||
        req.headers?.["x-tenant-id"] ||
        req.query?.orgId ||
        req.query?.org_id ||
        req.body?.orgId ||
        req.body?.org_id ||
        (req.user && (req.user.orgId || req.user.org_id)) ||
        null;

      if (!orgId) {
        console.warn("[getLeaveTypesHandler] missing orgId in request", {
          path: req.path,
          headers: Object.keys(req.headers || {}).reduce((acc, k) => {
            if (["cookie", "authorization"].includes(k)) return acc;
            acc[k] = req.headers[k];
            return acc;
          }, {}),
          query: req.query,
        });
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "Missing org_id in headers or query.",
            ),
          );
      }

      console.log(`[getLeaveTypesHandler] resolved orgId=${orgId}`);

      let types = null;
      try {
        types = await LeaveService.getLeaveTypes(orgId);
        if (types && !Array.isArray(types) && Array.isArray(types.data))
          types = types.data;
        console.log(
          `[getLeaveTypesHandler] LeaveService returned count=${(types || []).length}`,
        );
      } catch (svcErr) {
        console.warn(
          "[getLeaveTypesHandler] LeaveService.getLeaveTypes threw:",
          svcErr && svcErr.message ? svcErr.message : svcErr,
        );
        types = null;
      }

      if (!Array.isArray(types) || types.length === 0) {
        console.log(
          `[getLeaveTypesHandler] no types from service for orgId=${orgId}, attempting tenant DB fallback`,
        );
        let tenantPoolManagerLocal = null;
        try {
          tenantPoolManagerLocal = require("../db/tenantPoolManager");
        } catch (e) {
          tenantPoolManagerLocal = null;
        }

        if (
          tenantPoolManagerLocal &&
          typeof tenantPoolManagerLocal.getTenantPool === "function"
        ) {
          try {
            const sanitizeDbName =
              tenantPoolManagerLocal.sanitizeDbName || ((n) => n);
            const dbName = sanitizeDbName(`tenant_${orgId}`);
            console.log(
              `[getLeaveTypesHandler] tenant fallback using dbName=${dbName}`,
            );
            const pool = await tenantPoolManagerLocal.getTenantPool(dbName);
            if (pool && typeof pool.execute === "function") {
              const query =
                `
              SELECT
                id,
                COALESCE(type_key, ` +
                "`key`" +
                `, '') AS type_key,
                COALESCE(display_name, label, name, '') AS display_name,
                COALESCE(is_active, 1) AS is_active
              FROM leave_types
              ORDER BY display_name ASC
              LIMIT 1000
            `;
              const [rows] = await pool.execute(query, []);
              if (Array.isArray(rows) && rows.length > 0) {
                types = rows.map((r) => ({
                  id: r.id,
                  key: String(r.type_key || "")
                    .trim()
                    .toLowerCase(),
                  label:
                    r.display_name || String(r.type_key || r.name || "").trim(),
                  is_active: Number(r.is_active || 1) === 1,
                }));
                console.log(
                  `[getLeaveTypesHandler] tenant DB returned ${types.length} rows`,
                );
              } else {
                console.log("[getLeaveTypesHandler] tenant DB returned 0 rows");
              }
            } else {
              console.warn(
                "[getLeaveTypesHandler] tenant pool not available or invalid",
              );
            }
          } catch (dbErr) {
            console.warn(
              "[getLeaveTypesHandler] tenant DB fallback failed:",
              dbErr && dbErr.message ? dbErr.message : dbErr,
            );
          }
        } else {
          console.warn(
            "[getLeaveTypesHandler] tenantPoolManager not present, skipping tenant DB fallback",
          );
        }
      }

      if (!Array.isArray(types) || types.length === 0) {
        return res
          .status(200)
          .json(
            ErrorHandler.generateSuccessResponse(
              200,
              "Leave types fetched.",
              [],
            ),
          );
      }

      return res
        .status(200)
        .json(
          ErrorHandler.generateSuccessResponse(
            200,
            "Leave types fetched.",
            types,
          ),
        );
    } catch (err) {
      console.error(
        "[LeaveHandler.getLeaveTypesHandler] error:",
        err && err.stack ? err.stack : err,
      );
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(
            500,
            "Failed to fetch leave types.",
          ),
        );
    }
  }

  static async getLeaveQueries(req, res) {
    try {
      const {
        status = "",
        search = "",
        from_date = "",
        to_date = "",
      } = req.query;

      const org_id = resolveOrgId(req);

      if (!org_id) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "Missing org_id in headers.",
            ),
          );
      }

      if (
        (from_date && isNaN(Date.parse(from_date))) ||
        (to_date && isNaN(Date.parse(to_date)))
      ) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(400, "Invalid date format."),
          );
      }

      const leaveQueries = await LeaveService.getLeaveQueries({
        status,
        search,
        from_date,
        to_date,
        org_id,
      });

      // Enrich with attachments
      const enriched = await Promise.all(
        leaveQueries.map(async (leave) => {
          try {
            const id = leave.id || leave.leave_id || leave.leaveId || null;
            if (!id) return { ...leave, attachments: [] };

            const atts = await LeaveService.getAttachmentsForLeave(id, org_id);
            const attachments = Array.isArray(atts)
              ? atts.map((a) => buildPublicAttachment(a, org_id, req))
              : [];
            return { ...leave, attachments };
          } catch (err) {
            console.warn(
              "[getLeaveQueries] failed to fetch attachments for leave",
              {
                leave,
                err: err && err.message ? err.message : err,
              },
            );
            return { ...leave, attachments: [] };
          }
        }),
      );

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: enriched,
      });
    } catch (err) {
      console.error("Error in LeaveHandler.getLeaveQueries:", err);
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(500, "Internal server error."),
        );
    }
  }

  static async updateLeaveRequest(req, res) {
    try {
      const { leaveId } = req.params;
      const raw = req.body || {};

      const statusRaw = (raw.status || "").toString().trim();
      const statusNorm =
        statusRaw.toLowerCase() === "approved"
          ? "Approved"
          : statusRaw.toLowerCase() === "rejected"
            ? "Rejected"
            : statusRaw;

      if (!["Approved", "Rejected"].includes(statusNorm)) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "Invalid status. Status must be 'Approved' or 'Rejected'.",
            ),
          );
      }

      if (statusNorm === "Rejected" && !raw.comments) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "Rejection reason is required when rejecting a leave request.",
            ),
          );
      }

      const actorId =
        raw.actorId ??
        raw.actor ??
        (req.user && (req.user.id || req.user.employee_id)) ??
        req.headers?.["x-employee-id"] ??
        req.headers?.["x-actor-id"] ??
        null;

      const compensated_days =
        Number(
          raw.compensated_days ?? raw.compensatedDays ?? raw.compensated ?? 0,
        ) || 0;
      const deducted_days =
        Number(raw.deducted_days ?? raw.deductedDays ?? raw.deducted ?? 0) || 0;
      const loss_of_pay_days =
        Number(
          raw.loss_of_pay_days ??
            raw.lopDays ??
            raw.loss_of_pay ??
            raw.loss_of_pay_days ??
            0,
        ) || 0;
      const preserved_leave_days =
        raw.preserved_leave_days ??
        raw.preservedLeaveDays ??
        raw.preserved ??
        null;
      const preserved =
        preserved_leave_days === null ? null : Number(preserved_leave_days);

      const rawIsDefault =
        raw.is_defaulted ??
        raw.isDefaulted ??
        req.headers?.["x-is-defaulted"] ??
        false;
      const is_defaulted = parseBoolFlexible(rawIsDefault);

      const orgId = resolveOrgId(req);
      if (!orgId) {
        return res
          .status(400)
          .json(ErrorHandler.generateErrorResponse(400, "Missing org_id"));
      }

      const payload = {
        leaveId,
        status: statusNorm,
        comments: raw.comments || null,
        compensated_days,
        deducted_days,
        loss_of_pay_days,
        preserved_leave_days: preserved === null ? null : preserved,
        actorId,
        is_defaulted,
      };

      let result;
      try {
        result = await LeaveService.updateLeaveRequest(payload, orgId);
      } catch (svcErr) {
        console.error(
          `[LeaveHandler.updateLeaveRequest] LeaveService.updateLeaveRequest threw:`,
          svcErr && svcErr.stack ? svcErr.stack : svcErr,
        );
        const msg =
          svcErr && svcErr.message
            ? svcErr.message
            : "Internal error updating leave";
        if (svcErr && svcErr.isBadRequest) {
          return res
            .status(400)
            .json(ErrorHandler.generateErrorResponse(400, msg));
        }
        return res
          .status(500)
          .json(ErrorHandler.generateErrorResponse(500, msg));
      }

      const message = `Leave request ${String(statusNorm).toLowerCase()} successfully.`;

      return res
        .status(200)
        .json(ErrorHandler.generateSuccessResponse(200, message, result || {}));
    } catch (err) {
      console.error(
        "[LeaveHandler.updateLeaveRequest] Caught error:",
        err && err.stack ? err.stack : err,
      );
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(500, "Internal server error."),
        );
    }
  }

  static async submitLeaveRequestHandler(req, res) {
    try {
      const orgId = resolveOrgId(req);
      const { employeeId, reason, leavetype, h_f_day, startDate, endDate } =
        req.body || {};

      if (
        !employeeId ||
        !startDate ||
        !endDate ||
        !h_f_day ||
        !reason ||
        !leavetype
      ) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(400, "All fields are required."),
          );
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end < start) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "End date cannot be earlier than start date.",
            ),
          );
      }

      if (leavetype === "Casual" || leavetype === "Vacation") {
        const today = new Date();
        const minStart = new Date();
        minStart.setDate(today.getDate() + 3);
        if (start < minStart) {
          return res
            .status(400)
            .json(
              ErrorHandler.generateErrorResponse(
                400,
                "Casual or Vacation leave must be applied at least 3 days in advance.",
              ),
            );
        }
      }

      const existingLeaves = await LeaveService.getLeaveRequests(
        employeeId,
        null,
        null,
        orgId,
      );
      const newStart = new Date(startDate);
      const newEnd = new Date(endDate);
      const newDayStr = newStart.toISOString().split("T")[0];
      const isSingleOrHalf =
        newDayStr === newEnd.toISOString().split("T")[0] ||
        h_f_day === "Half Day";

      const hasOverlap = existingLeaves.some((leave) => {
        const existingStart = new Date(leave.start_date);
        const existingEnd = new Date(leave.end_date);
        const existingStartStr = existingStart.toISOString().split("T")[0];
        const existingEndStr = existingEnd.toISOString().split("T")[0];

        if (isSingleOrHalf) {
          return existingStartStr === newDayStr || existingEndStr === newDayStr;
        } else {
          return (
            (newStart >= existingStart && newStart <= existingEnd) ||
            (newEnd >= existingStart && newEnd <= existingEnd) ||
            (existingStart >= newStart && existingEnd <= newEnd)
          );
        }
      });

      if (hasOverlap) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "You already have a leave request on the selected date(s).",
            ),
          );
      }

      const leaveRequest = await LeaveService.submitLeaveRequest({
        employeeId,
        startDate,
        endDate,
        h_f_day,
        reason,
        leavetype,
        orgId,
      });

      const files = Array.isArray(req.files) ? req.files : [];
      let inserted = [];
      if (files.length > 0) {
        try {
          inserted = await LeaveService.saveLeaveAttachments(
            leaveRequest.id,
            files,
            orgId,
          );
        } catch (attachErr) {
          console.warn(
            "[submitLeaveRequestHandler] failed to save attachments:",
            attachErr && attachErr.message ? attachErr.message : attachErr,
          );
        }
      }

      // Map inserted attachments to public shape if available
      const mappedInserted = Array.isArray(inserted)
        ? inserted.map((a) => buildPublicAttachment(a, orgId, req))
        : [];

      const responseData = Object.assign({}, leaveRequest, {
        attachments: mappedInserted,
      });

      return res
        .status(200)
        .json(
          ErrorHandler.generateSuccessResponse(
            200,
            "Leave request submitted successfully.",
            responseData,
          ),
        );
    } catch (err) {
      console.error("Error in submitLeaveRequestHandler:", {
        error: err && err.message ? err.message : err,
        body: req.body,
      });
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(
            500,
            "Failed to submit leave request.",
          ),
        );
    }
  }
  static async getLeaveRequestsHandler(req, res) {
    try {
      const { employeeId } = req.params;
      const { from_date, to_date } = req.query;
      const orgId = resolveOrgId(req);

      if (!employeeId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(400, "Employee ID is required."),
          );
      }

      const leaveRequests = await LeaveService.getLeaveRequests(
        employeeId,
        from_date,
        to_date,
        orgId,
      );

      if (!Array.isArray(leaveRequests) || leaveRequests.length === 0) {
        return res
          .status(200)
          .json(
            ErrorHandler.generateSuccessResponse(
              200,
              "Leave requests fetched successfully.",
              [],
            ),
          );
      }

      const enriched = await Promise.all(
        leaveRequests.map(async (leave) => {
          try {
            const id = leave.id || leave.leave_id || leave.leaveId || null;
            if (!id) return { ...leave, attachments: [] };

            const atts = await LeaveService.getAttachmentsForLeave(id, orgId);
            const attachments = Array.isArray(atts)
              ? atts.map((a) => buildPublicAttachment(a, orgId, req))
              : [];
            return { ...leave, attachments };
          } catch (err) {
            console.warn(
              "[getLeaveRequestsHandler] failed to fetch attachments for leave",
              {
                leave,
                err: err && err.message ? err.message : err,
              },
            );
            return { ...leave, attachments: [] };
          }
        }),
      );

      return res
        .status(200)
        .json(
          ErrorHandler.generateSuccessResponse(
            200,
            "Leave requests fetched successfully.",
            enriched,
          ),
        );
    } catch (err) {
      console.error("Error in getLeaveRequestsHandler:", err);
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(
            500,
            "Error fetching leave requests.",
          ),
        );
    }
  }

  static async editLeaveRequestHandler(req, res) {
    try {
      const { leaveId } = req.params;
      const orgId = resolveOrgId(req);

      const { employeeId, startDate, endDate, h_f_day, reason, leavetype } =
        req.body;

      if (
        !leaveId ||
        !employeeId ||
        !startDate ||
        !endDate ||
        !h_f_day ||
        !reason ||
        !leavetype
      ) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(400, "All fields are required."),
          );
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end < start) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "End date cannot be earlier than start date.",
            ),
          );
      }

      if (leavetype === "Casual" || leavetype === "Vacation") {
        const today = new Date();
        const minStart = new Date();
        minStart.setDate(today.getDate() + 3);
        if (start < minStart) {
          return res
            .status(400)
            .json(
              ErrorHandler.generateErrorResponse(
                400,
                "Casual or Vacation leave must be applied at least 3 days in advance.",
              ),
            );
        }
      }

      const existingLeaves = await LeaveService.getLeaveRequests(
        employeeId,
        null,
        null,
        orgId,
      );
      const newStart = new Date(startDate);
      const newEnd = new Date(endDate);
      const newDayStr = newStart.toISOString().split("T")[0];
      const isSingleOrHalf =
        newDayStr === newEnd.toISOString().split("T")[0] ||
        h_f_day === "Half Day";

      const hasOverlap = existingLeaves.some((leave) => {
        if (String(leave.id) === String(leaveId)) return false;
        const existingStart = new Date(leave.start_date);
        const existingEnd = new Date(leave.end_date);
        const existingStartStr = existingStart.toISOString().split("T")[0];
        const existingEndStr = existingEnd.toISOString().split("T")[0];

        if (isSingleOrHalf) {
          return existingStartStr === newDayStr || existingEndStr === newDayStr;
        } else {
          return (
            (newStart >= existingStart && newStart <= existingEnd) ||
            (newEnd >= existingStart && newEnd <= existingEnd) ||
            (existingStart >= newStart && existingEnd <= newEnd)
          );
        }
      });

      if (hasOverlap) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "The new dates conflict with an existing leave request.",
            ),
          );
      }

      const updatedLeaveRequest = await LeaveService.editLeaveRequest({
        leaveId,
        employeeId,
        startDate,
        endDate,
        h_f_day,
        reason,
        leavetype,
        orgId,
      });

      return res
        .status(200)
        .json(
          ErrorHandler.generateSuccessResponse(
            200,
            "Leave request updated successfully.",
            updatedLeaveRequest,
          ),
        );
    } catch (err) {
      console.error("Error in editLeaveRequestHandler:", err);
      return res
        .status(500)
        .json(ErrorHandler.generateErrorResponse(500, err.message));
    }
  }

  static async cancelLeaveRequestHandler(req, res) {
    try {
      const { leaveId, employeeId } = req.params;
      const orgId = resolveOrgId(req);

      if (!leaveId || !employeeId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "Leave ID and Employee ID are required.",
            ),
          );
      }

      const message = await LeaveService.cancelLeaveRequest(
        leaveId,
        employeeId,
        orgId,
      );

      return res
        .status(200)
        .json(ErrorHandler.generateSuccessResponse(200, message));
    } catch (err) {
      console.error("Error in cancelLeaveRequestHandler:", err);
      return res
        .status(500)
        .json(ErrorHandler.generateErrorResponse(500, err.message));
    }
  }

  static async getLeaveRequestsForTeamLeadHandler(req, res) {
    try {
      const { teamLeadId } = req.params;
      const filters = req.query;
      const orgId = resolveOrgId(req);

      if (!orgId) {
        return res
          .status(400)
          .json(ErrorHandler.generateErrorResponse(400, "Missing org_id"));
      }

      const leaveRequests = await LeaveService.getLeaveQueriesForTeamLead(
        filters,
        teamLeadId,
        orgId,
      );

      // Enrich with attachments
      const enriched = await Promise.all(
        leaveRequests.map(async (leave) => {
          try {
            const id = leave.id || leave.leave_id || leave.leaveId || null;
            if (!id) return { ...leave, attachments: [] };

            const atts = await LeaveService.getAttachmentsForLeave(id, orgId);
            const attachments = Array.isArray(atts)
              ? atts.map((a) => buildPublicAttachment(a, orgId, req))
              : [];
            return { ...leave, attachments };
          } catch (err) {
            console.warn(
              "[getLeaveRequestsForTeamLeadHandler] failed to fetch attachments for leave",
              {
                leave,
                err: err && err.message ? err.message : err,
              },
            );
            return { ...leave, attachments: [] };
          }
        }),
      );

      return res.status(200).json(
        ErrorHandler.generateSuccessResponse(200, "Success", {
          data: enriched,
        }),
      );
    } catch (err) {
      console.error(
        "Error fetching leave requests for team lead:",
        err && err.message ? err.message : err,
      );
      return res
        .status(500)
        .json({ message: "Failed to fetch leave requests for team lead." });
    }
  }

  static async getAttachmentsHandler(req, res) {
    try {
      const orgId = resolveOrgId(req);
      const leaveId = req.params?.id || req.query?.leaveId;
      if (!orgId || !leaveId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "orgId and leaveId are required.",
            ),
          );
      }
      const attachments = await LeaveService.getAttachmentsForLeave(
        leaveId,
        orgId,
      );

      const mapped = Array.isArray(attachments)
        ? attachments.map((a) => buildPublicAttachment(a, orgId, req))
        : [];

      return res
        .status(200)
        .json(
          ErrorHandler.generateSuccessResponse(
            200,
            "Attachments fetched.",
            mapped,
          ),
        );
    } catch (err) {
      console.error("[getAttachmentsHandler] error:", err);
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(
            500,
            "Failed to fetch attachments.",
          ),
        );
    }
  }
  static async addAttachmentsHandler(req, res) {
    try {
      const orgId = resolveOrgId(req);
      const leaveId = req.params?.id || req.body?.leaveId;
      const employeeId =
        req.headers?.["x-employee-id"] ||
        req.headers?.["x_employee_id"] ||
        req.body?.employeeId ||
        req.body?.employee_id ||
        null;

      if (!orgId || !leaveId) {
        console.warn("[addAttachmentsHandler] missing orgId or leaveId", {
          headers: req.headers,
          body: req.body,
          params: req.params,
        });
        return res.status(400).json({
          success: false,
          code: 400,
          message: "orgId and leaveId are required.",
        });
      }

      const files = Array.isArray(req.files) ? req.files : [];
      console.debug(`[addAttachmentsHandler] received ${files.length} files`, {
        leaveId,
        orgId,
        employeeId,
        sampleFiles: files.slice(0, 5).map((f) => ({
          originalname: f.originalname,
          path: f.path,
          mimetype: f.mimetype,
          size: f.size,
        })),
      });
      console.log("[addAttachmentsHandler] Received files:", req.files);
      console.log("[addAttachmentsHandler] orgId:", orgId, "leaveId:", leaveId);

      if (!files.length) {
        return res
          .status(400)
          .json({ success: false, code: 400, message: "No files uploaded." });
      }

      const inserted = await LeaveService.saveLeaveAttachments(
        leaveId,
        files,
        orgId,
      );

      const mappedInserted = Array.isArray(inserted)
        ? inserted.map((a) => buildPublicAttachment(a, orgId, req))
        : [];

      return res.status(200).json({
        success: true,
        code: 200,
        message: "Attachments uploaded.",
        data: mappedInserted,
      });
    } catch (err) {
      console.error(
        "[addAttachmentsHandler] error:",
        err && err.stack ? err.stack : err,
      );
      return res.status(500).json({
        success: false,
        code: 500,
        message: "Failed to upload attachments.",
      });
    }
  }

  static async replaceAttachmentsHandler(req, res) {
    try {
      const orgId = resolveOrgId(req);
      const leaveId = req.params?.id || req.body?.leaveId;
      if (!orgId || !leaveId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "orgId and leaveId are required.",
            ),
          );
      }
      const files = Array.isArray(req.files) ? req.files : [];
      const result = await LeaveService.replaceAttachmentsForLeave(
        leaveId,
        files,
        orgId,
      );

      const mapped = Array.isArray(result)
        ? result.map((a) => buildPublicAttachment(a, orgId, req))
        : result;

      return res
        .status(200)
        .json(
          ErrorHandler.generateSuccessResponse(
            200,
            "Attachments replaced.",
            mapped,
          ),
        );
    } catch (err) {
      console.error("[replaceAttachmentsHandler] error:", err);
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(
            500,
            "Failed to replace attachments.",
          ),
        );
    }
  }

  static async deleteAttachmentHandler(req, res) {
    try {
      const orgId = resolveOrgId(req);
      const attachmentId = req.params?.attachmentId;
      if (!orgId || !attachmentId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "orgId and attachmentId are required.",
            ),
          );
      }

      const ok = await LeaveService.deleteAttachmentById(attachmentId, orgId);
      if (!ok) {
        return res
          .status(404)
          .json(
            ErrorHandler.generateErrorResponse(404, "Attachment not found."),
          );
      }
      return res
        .status(200)
        .json(ErrorHandler.generateSuccessResponse(200, "Attachment deleted."));
    } catch (err) {
      console.error("[deleteAttachmentHandler] error:", err);
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(
            500,
            "Failed to delete attachment.",
          ),
        );
    }
  }

  static async serveAttachmentHandler(req, res) {
    try {
      const orgId = resolveOrgId(req) || req.query?.orgId;
      const attachmentId = req.params?.attachmentId;
      if (!orgId || !attachmentId) {
        return res.status(400).send("Missing orgId or attachmentId");
      }

      const attachment = await LeaveService.getAttachmentById(
        attachmentId,
        orgId,
      );
      if (!attachment) return res.status(404).send("Attachment not found");

      let abs = attachment.file_path || "";
      if (!path.isAbsolute(abs)) {
        abs = path.join(process.cwd(), abs);
      }
      const safeSegment = path.join(
        "uploads",
        "leave_attachments",
        String(orgId),
      );
      const normalizedAbs = path.normalize(abs);
      if (!normalizedAbs.includes(path.normalize(safeSegment))) {
        console.warn(
          "[serveAttachmentHandler] file path outside safe folder:",
          normalizedAbs,
        );
        return res.status(403).send("Forbidden");
      }

      if (!fs.existsSync(normalizedAbs)) {
        console.warn(
          "[serveAttachmentHandler] file missing on disk:",
          normalizedAbs,
        );
        return res.status(404).send("File missing");
      }

      const disposition = req.query?.download === "1" ? "attachment" : "inline";
      res.setHeader(
        "Content-Type",
        attachment.mime_type || "application/octet-stream",
      );
      const fname = (attachment.file_name || "attachment").replace(/"/g, "");
      res.setHeader(
        "Content-Disposition",
        `${disposition}; filename="${fname}"`,
      );
      return res.sendFile(normalizedAbs);
    } catch (err) {
      console.error("[serveAttachmentHandler] error:", err);
      return res.status(500).send("Failed to serve attachment");
    }
  }

  static async serveAttachmentByName(req, res) {
    try {
      const orgId = resolveOrgId(req) || req.query?.orgId;
      const name = req.query?.name || req.params?.name;
      const leaveId = req.query?.leaveId || req.params?.leaveId || null;

      if (!orgId || !name) {
        return res.status(400).send("Missing orgId or name");
      }

      // You'll implement this service method (see snippet below)
      const attachment = await LeaveService.getAttachmentByFileName(
        name,
        orgId,
        leaveId,
      );
      if (!attachment) {
        return res.status(404).send("Attachment not found");
      }

      // Reuse same logic as serveAttachmentHandler to resolve abs path and safety checks
      let abs = attachment.file_path || "";
      if (!path.isAbsolute(abs)) {
        abs = path.join(process.cwd(), abs);
      }

      // safer check using path.resolve / startsWith:
      const uploadsRoot = path.resolve(
        process.cwd(),
        "uploads",
        "leave_attachments",
        String(orgId),
      );
      const normalizedAbs = path.resolve(abs);
      if (!normalizedAbs.startsWith(uploadsRoot)) {
        console.warn("[serveAttachmentByName] file path outside safe folder:", {
          normalizedAbs,
          uploadsRoot,
        });
        return res.status(403).send("Forbidden");
      }

      if (!fs.existsSync(normalizedAbs)) {
        console.warn(
          "[serveAttachmentByName] file missing on disk:",
          normalizedAbs,
        );
        return res.status(404).send("File missing");
      }

      const disposition = req.query?.download === "1" ? "attachment" : "inline";
      res.setHeader(
        "Content-Type",
        attachment.mime_type || "application/octet-stream",
      );
      const fname = (attachment.file_name || "attachment").replace(/"/g, "");
      res.setHeader(
        "Content-Disposition",
        `${disposition}; filename="${fname}"`,
      );
      return res.sendFile(normalizedAbs);
    } catch (err) {
      console.error("[serveAttachmentByName] error:", err);
      return res.status(500).send("Failed to serve attachment by name");
    }
  }
}
module.exports = LeaveHandler;
