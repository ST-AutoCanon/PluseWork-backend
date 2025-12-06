const LeaveService = require("../services/leaveService");
const ErrorHandler = require("../utils/errorHandler");

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

class LeaveHandler {
  static async getLeaveQueries(req, res) {
    try {
      const {
        status = "",
        search = "",
        from_date = "",
        to_date = "",
      } = req.query;

      const org_id =
        req.headers["org_id"] ||
        req.headers["org-id"] ||
        req.headers["x-org-id"] ||
        req.headers["x-org_id"];

      if (!org_id) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "Missing org_id in headers."
            )
          );
      }

      if (
        (from_date && isNaN(Date.parse(from_date))) ||
        (to_date && isNaN(Date.parse(to_date)))
      ) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(400, "Invalid date format.")
          );
      }

      const leaveQueries = await LeaveService.getLeaveQueries({
        status,
        search,
        from_date,
        to_date,
        org_id,
      });

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: leaveQueries,
      });
    } catch (err) {
      console.error("Error in LeaveHandler.getLeaveQueries:", err);
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(500, "Internal server error.")
        );
    }
  }

  static async updateLeaveRequest(req, res) {
    try {
      const { leaveId } = req.params;
      const {
        status,
        comments,
        compensated_days = 0,
        deducted_days = 0,
        loss_of_pay_days = 0,
        preserved_leave_days = null,
      } = req.body || {};

      if (!["Approved", "Rejected"].includes(status)) {
        console.warn(
          "[LeaveHandler.updateLeaveRequest] VALIDATION FAILED - invalid status:",
          status
        );
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "Invalid status. Status must be 'Approved' or 'Rejected'."
            )
          );
      }

      if (status === "Rejected" && !comments) {
        console.warn(
          "[LeaveHandler.updateLeaveRequest] VALIDATION FAILED - rejection without comments"
        );
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "Rejection reason is required when rejecting a leave request."
            )
          );
      }
      if (status === "Rejected") {
      }

      const actorIdFromBody =
        (req.body && (req.body.actorId ?? req.body.actor)) ?? null;
      const actorIdFromUser =
        (req.user && (req.user.id ?? req.user.employee_id)) ?? null;
      const actorIdFromHeader =
        req.headers &&
        (req.headers["x-employee-id"] || req.headers["x-actor-id"]);
      const actorId =
        actorIdFromBody || actorIdFromUser || actorIdFromHeader || null;

      const rawIsDefault =
        (req.body &&
          (req.body.is_defaulted ??
            req.body.isDefaulted ??
            req.body.is_default ??
            req.body.isDefault ??
            req.body.defaulted)) ??
        (req.headers &&
          (req.headers["x-is-defaulted"] || req.headers["x-defaulted"]));

      const is_defaulted = parseBoolFlexible(rawIsDefault);

      const payload = {
        leaveId,
        status,
        comments: comments || null,
        compensated_days: Number(compensated_days) || 0,
        deducted_days: Number(deducted_days) || 0,
        loss_of_pay_days: Number(loss_of_pay_days) || 0,
        preserved_leave_days:
          preserved_leave_days === null ? null : Number(preserved_leave_days),
        actorId,
        is_defaulted,
      };

      await LeaveService.updateLeaveRequest(payload);

      const message = `Leave request ${String(
        status
      ).toLowerCase()} successfully.`;

      return res
        .status(200)
        .json(ErrorHandler.generateSuccessResponse(200, message));
    } catch (err) {
      console.error("[LeaveHandler.updateLeaveRequest] Caught error:", err);

      if (err && err.isBadRequest) {
        console.warn(
          "[LeaveHandler.updateLeaveRequest] Returning 400 due to controlled error:",
          err.message
        );
        return res
          .status(400)
          .json(ErrorHandler.generateErrorResponse(400, err.message));
      }

      console.error(
        "[LeaveHandler.updateLeaveRequest] Returning 500 - internal server error"
      );
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(500, "Internal server error.")
        );
    }
  }

  static async submitLeaveRequestHandler(req, res) {
    try {
      const orgId =
        req.headers["x-org-id"] ||
        req.query?.orgId ||
        req.body?.orgId ||
        (req.user && req.user.orgId) ||
        null;
      const { employeeId, reason, leavetype, h_f_day, startDate, endDate } =
        req.body;

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
            ErrorHandler.generateErrorResponse(400, "All fields are required.")
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
              "End date cannot be earlier than start date."
            )
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
                "Casual or Vacation leave must be applied at least 3 days in advance."
              )
            );
        }
      }

      const existingLeaves = await LeaveService.getLeaveRequests(employeeId);
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
              "You already have a leave request on the selected date(s)."
            )
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

      return res
        .status(200)
        .json(
          ErrorHandler.generateSuccessResponse(
            "Leave request submitted successfully.",
            leaveRequest
          )
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
            "Failed to submit leave request."
          )
        );
    }
  }

  static async getLeaveRequestsHandler(req, res) {
    try {
      const { employeeId } = req.params;
      const { from_date, to_date } = req.query;

      if (!employeeId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(400, "Employee ID is required.")
          );
      }

      const leaveRequests = await LeaveService.getLeaveRequests(
        employeeId,
        from_date,
        to_date
      );

      return res
        .status(200)
        .json(
          ErrorHandler.generateSuccessResponse(
            200,
            "Leave requests fetched successfully.",
            leaveRequests
          )
        );
    } catch (err) {
      console.error("Error in getLeaveRequestsHandler:", err);
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(
            500,
            "Error fetching leave requests."
          )
        );
    }
  }

  static async editLeaveRequestHandler(req, res) {
    try {
      const { leaveId } = req.params;

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
            ErrorHandler.generateErrorResponse(400, "All fields are required.")
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
              "End date cannot be earlier than start date."
            )
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
                "Casual or Vacation leave must be applied at least 3 days in advance."
              )
            );
        }
      }

      const existingLeaves = await LeaveService.getLeaveRequests(employeeId);
      const newStart = new Date(startDate);
      const newEnd = new Date(endDate);
      const newDayStr = newStart.toISOString().split("T")[0];
      const isSingleOrHalf =
        newDayStr === newEnd.toISOString().split("T")[0] ||
        h_f_day === "Half Day";

      const hasOverlap = existingLeaves.some((leave) => {
        if (leave.id == leaveId) return false;
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
              "The new dates conflict with an existing leave request."
            )
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
      });

      return res
        .status(200)
        .json(
          ErrorHandler.generateSuccessResponse(
            200,
            "Leave request updated successfully.",
            updatedLeaveRequest
          )
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

      if (!leaveId || !employeeId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "Leave ID and Employee ID are required."
            )
          );
      }

      const message = await LeaveService.cancelLeaveRequest(
        leaveId,
        employeeId
      );

      return res
        .status(200)
        .json(ErrorHandler.generateSuccessResponse(message));
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

      const leaveRequests = await LeaveService.getLeaveQueriesForTeamLead(
        filters,
        teamLeadId
      );
      return res
        .status(200)
        .json(
          ErrorHandler.generateSuccessResponse(200, { data: leaveRequests })
        );
    } catch (err) {
      console.error(
        "Error fetching leave requests for team lead:",
        err && err.message ? err.message : err
      );
      return res
        .status(500)
        .json({ message: "Failed to fetch leave requests for team lead." });
    }
  }
}

module.exports = LeaveHandler;
