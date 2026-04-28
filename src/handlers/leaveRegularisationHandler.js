const LeaveRegularisationService = require("../services/leaveRegularisationService");
const ErrorHandler = require("../utils/errorHandler");

function resolveOrgId(req) {
  return (
    req.orgId ||
    req.headers?.["x-org-id"] ||
    req.headers?.["x_org_id"] ||
    req.query?.orgId ||
    req.query?.org_id ||
    req.body?.orgId ||
    req.body?.org_id ||
    (req.user && (req.user.orgId || req.user.org_id)) ||
    null
  );
}

function resolveEmployeeId(req) {
  return (
    req.employeeId ||
    req.headers?.["x-employee-id"] ||
    req.headers?.["x_employee_id"] ||
    req.query?.employeeId ||
    req.query?.employee_id ||
    req.body?.employeeId ||
    req.body?.employee_id ||
    (req.user && (req.user.employeeId || req.user.employee_id)) ||
    null
  );
}

function resolveRole(req) {
  return (
    req.role ||
    req.headers?.["x-role"] ||
    req.query?.role ||
    req.body?.role ||
    (req.user && req.user.role) ||
    ""
  );
}

function resolveEmployeeIds(req) {
  const raw =
    req.query?.employeeIds ||
    req.query?.employee_ids ||
    req.body?.employeeIds ||
    req.body?.employee_ids ||
    null;

  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim()).filter(Boolean);
  }

  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((v) => String(v).trim())
      .filter(Boolean);
  }

  return [];
}

function setNoCache(res) {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

class LeaveRegularisationHandler {
  static async getEligibleDatesHandler(req, res) {
    try {
      setNoCache(res);

      const orgId = resolveOrgId(req);
      const employeeId = resolveEmployeeId(req);
      const { regularisationType, fromDate, toDate } = req.query || {};

      if (!orgId || !employeeId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "Missing org_id or employee_id.",
            ),
          );
      }

      const result = await LeaveRegularisationService.getEligibleDates({
        employeeId,
        orgId,
        regularisationType,
        fromDate,
        toDate,
      });

      return res
        .status(result.status)
        .json(
          result.success
            ? ErrorHandler.generateSuccessResponse(
                result.status,
                result.message,
                result.data,
              )
            : ErrorHandler.generateErrorResponse(result.status, result.message),
        );
    } catch (err) {
      console.error("[getEligibleDatesHandler] error:", err);
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(
            500,
            "Failed to fetch eligible dates.",
          ),
        );
    }
  }

  static async submitRegularisationHandler(req, res) {
    try {
      setNoCache(res);

      const orgId = resolveOrgId(req);
      const employeeId = resolveEmployeeId(req);
      const { regularisationType, selectedDates, comment } = req.body || {};

      if (!orgId || !employeeId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "Missing org_id or employee_id.",
            ),
          );
      }

      const result = await LeaveRegularisationService.submitRegularisation({
        employeeId,
        orgId,
        regularisationType,
        selectedDates,
        comment,
      });

      return res
        .status(result.status)
        .json(
          result.success
            ? ErrorHandler.generateSuccessResponse(
                result.status,
                result.message,
                result.data,
              )
            : ErrorHandler.generateErrorResponse(result.status, result.message),
        );
    } catch (err) {
      console.error("[submitRegularisationHandler] error:", err);
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(
            500,
            "Failed to submit regularisation request.",
          ),
        );
    }
  }

  static async getMyRegularisationRequestsHandler(req, res) {
    try {
      setNoCache(res);

      const orgId = resolveOrgId(req);
      const employeeId = resolveEmployeeId(req);

      if (!orgId || !employeeId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "Missing org_id or employee_id.",
            ),
          );
      }

      const result =
        await LeaveRegularisationService.getMyRegularisationRequests({
          employeeId,
          orgId,
        });

      return res
        .status(result.status)
        .json(
          result.success
            ? ErrorHandler.generateSuccessResponse(
                result.status,
                result.message,
                result.data,
              )
            : ErrorHandler.generateErrorResponse(result.status, result.message),
        );
    } catch (err) {
      console.error("[getMyRegularisationRequestsHandler] error:", err);
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(
            500,
            "Failed to fetch regularisation requests.",
          ),
        );
    }
  }

  static async getRegularisationRequestsHandler(req, res) {
    try {
      setNoCache(res);

      const orgId = resolveOrgId(req);
      const employeeId = resolveEmployeeId(req);
      const role = resolveRole(req);
      const scope = String(req.query?.scope || req.body?.scope || "self")
        .trim()
        .toLowerCase();
      const status = req.query?.status || req.body?.status || "";
      const fromDate = req.query?.fromDate || req.body?.fromDate || "";
      const toDate = req.query?.toDate || req.body?.toDate || "";
      const search = req.query?.search || req.body?.search || "";
      const employeeIds = resolveEmployeeIds(req);

      if (!orgId) {
        return res
          .status(400)
          .json(ErrorHandler.generateErrorResponse(400, "Missing org_id."));
      }

      const result = await LeaveRegularisationService.getRegularisationRequests(
        {
          orgId,
          employeeId,
          role,
          scope,
          status,
          fromDate,
          toDate,
          search,
          employeeIds,
        },
      );

      return res
        .status(result.status)
        .json(
          result.success
            ? ErrorHandler.generateSuccessResponse(
                result.status,
                result.message,
                result.data,
              )
            : ErrorHandler.generateErrorResponse(result.status, result.message),
        );
    } catch (err) {
      console.error("[getRegularisationRequestsHandler] error:", err);
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(
            500,
            "Failed to fetch regularisation requests.",
          ),
        );
    }
  }

  static async updateRegularisationRequestHandler(req, res) {
    try {
      setNoCache(res);

      const orgId = resolveOrgId(req);
      const employeeId = resolveEmployeeId(req);
      const role = resolveRole(req);
      const { id } = req.params;

      const {
        status,
        approver_comments,
        approverComments,
        approver_name,
        approverName,
        approver_id,
        approverId,
      } = req.body || {};

      if (!orgId || !employeeId || !id) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "Missing org_id, employee_id or request id.",
            ),
          );
      }

      const result =
        await LeaveRegularisationService.updateRegularisationRequest({
          orgId,
          employeeId,
          role,
          id,
          status,
          approverComments: approver_comments || approverComments || "",
          approverName: approver_name || approverName || "",
          approverId: approver_id || approverId || employeeId,
        });

      return res
        .status(result.status)
        .json(
          result.success
            ? ErrorHandler.generateSuccessResponse(
                result.status,
                result.message,
                result.data,
              )
            : ErrorHandler.generateErrorResponse(result.status, result.message),
        );
    } catch (err) {
      console.error("[updateRegularisationRequestHandler] error:", err);
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(
            500,
            "Failed to update regularisation request.",
          ),
        );
    }
  }

  static async getRegularisationRequestByIdHandler(req, res) {
    try {
      setNoCache(res);

      const orgId = resolveOrgId(req);
      const employeeId = resolveEmployeeId(req);
      const { id } = req.params;

      if (!orgId || !employeeId || !id) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "Missing org_id, employee_id or request id.",
            ),
          );
      }

      const result =
        await LeaveRegularisationService.getRegularisationRequestById({
          employeeId,
          orgId,
          id,
        });

      return res
        .status(result.status)
        .json(
          result.success
            ? ErrorHandler.generateSuccessResponse(
                result.status,
                result.message,
                result.data,
              )
            : ErrorHandler.generateErrorResponse(result.status, result.message),
        );
    } catch (err) {
      console.error("[getRegularisationRequestByIdHandler] error:", err);
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(
            500,
            "Failed to fetch regularisation request.",
          ),
        );
    }
  }
}

module.exports = LeaveRegularisationHandler;
