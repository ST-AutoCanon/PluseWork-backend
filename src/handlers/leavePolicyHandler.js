// src/handlers/leavePolicyHandler.js
const LeavePolicyService = require("../services/leavePolicyService");
const ErrorHandler = require("../utils/errorHandler");

// tenant pool helper (used only as a last-resort fallback)
let tenantPoolManager = null;
try {
  tenantPoolManager = require("../db/tenantPoolManager");
} catch (e) {
  tenantPoolManager = null;
}

/**
 * Resolve orgId from common places (headers, query, body, session, user)
 */
const resolveOrgId = (req) => {
  try {
    return (
      req.headers?.["x-org-id"] ||
      req.headers?.["x_org_id"] ||
      req.headers?.["x-orgid"] ||
      req.headers?.["org-id"] ||
      req.headers?.["orgid"] ||
      req.headers?.["org_id"] ||
      req.query?.orgId ||
      req.query?.org_id ||
      req.query?.orgid ||
      req.body?.orgId ||
      req.body?.org_id ||
      (req.session && (req.session.orgId || req.session.org_id)) ||
      (req.user && (req.user.orgId || req.user.org_id)) ||
      null
    );
  } catch (e) {
    return null;
  }
};

function normalizeKey(s = "") {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function buildDefaultSettingsFromTypesArray(arr = []) {
  const candidates = Array.isArray(arr) ? arr : [];
  if (candidates.length === 0) {
    return [
      {
        type: "casual",
        label: "Casual Leave",
        value: 0,
        carry_forward: 0,
        enabled: true,
        advance_notice_days: 3,
      },
      {
        type: "vacation",
        label: "Vacation Leave",
        value: 0,
        carry_forward: 0,
        enabled: true,
        advance_notice_days: 3,
      },
      {
        type: "sick",
        label: "Sick Leave",
        value: 0,
        carry_forward: 0,
        enabled: true,
        advance_notice_days: 0,
      },
      {
        type: "other",
        label: "Other Leave",
        value: 0,
        carry_forward: 0,
        enabled: true,
        advance_notice_days: 3,
      },
    ];
  }

  return candidates.map((t) => {
    const rawKey =
      t.key ??
      t.type_key ??
      t.type ??
      t.name ??
      t.display_name ??
      t.label ??
      "";
    const key = normalizeKey(rawKey || "");
    const label =
      t.label ?? t.display_name ?? t.name ?? (rawKey ? String(rawKey) : key);
    const advance = [
      "casual",
      "vacation",
      "casual_leave",
      "vacation_leave",
    ].includes(key.toLowerCase())
      ? 3
      : 0;
    return {
      type: key || label,
      label,
      value: 0,
      carry_forward: 0,
      enabled:
        typeof t.is_active === "boolean"
          ? t.is_active
          : typeof t.active === "boolean"
            ? t.active
            : true,
      advance_notice_days: advance,
    };
  });
}

class LeavePolicyHandler {
  static async autoExtendHandler(req, res) {
    try {
      const orgId = resolveOrgId(req);
      const actorId =
        req.headers["x-employee-id"] || req.body?.actorId || "system";

      if (!orgId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "Missing orgId (x-org-id header or orgId in body/query).",
            ),
          );
      }

      const extensionDays = Number(req.body?.extensionDays) || 90;
      const created = await LeavePolicyService.autoExtendRecentPolicies(
        extensionDays,
        actorId,
        orgId,
      );

      return res.json({ success: true, data: created });
    } catch (err) {
      console.error(
        "[autoExtendHandler] error:",
        err && (err.stack || err.message || err),
      );
      return res
        .status(500)
        .json({ success: false, message: "Failed to auto-extend policies." });
    }
  }

  // getAllPolicies - defensive and non-caching
  static async getAllPolicies(req, res) {
    try {
      const orgId = resolveOrgId(req);

      if (!orgId) {
        return res
          .status(400)
          .json({ success: false, message: "orgId is required" });
      }

      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      );
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Surrogate-Control", "no-store");

      const policies = await LeavePolicyService.getAllPolicies(orgId);
      return res.status(200).json({ success: true, data: policies || [] });
    } catch (err) {
      console.error(
        "[getAllPolicies] error:",
        err && (err.stack || err.message || err),
      );
      const devMessage =
        process.env.NODE_ENV === "production"
          ? "Internal server error."
          : (err && err.message) || "Internal server error.";
      return res
        .status(500)
        .json(ErrorHandler.generateErrorResponse(500, devMessage));
    }
  }

  static async createPolicy(req, res) {
    try {
      const orgId = resolveOrgId(req);
      const { period, year_start, year_end, leave_settings } = req.body;

      if (
        !orgId ||
        !period ||
        !year_start ||
        !year_end ||
        !Array.isArray(leave_settings)
      ) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "orgId, period, year_start, year_end and leave_settings[] are required.",
            ),
          );
      }

      const newPolicy = await LeavePolicyService.createPolicy({
        period,
        year_start,
        year_end,
        leave_settings,
        orgId,
      });
      return res
        .status(201)
        .json(
          ErrorHandler.generateSuccessResponse(
            201,
            "Policy created.",
            newPolicy,
          ),
        );
    } catch (err) {
      console.error("createPolicy:", err && (err.stack || err.message || err));
      if (err && err.code === "OVERLAP") {
        return res
          .status(409)
          .json(
            ErrorHandler.generateErrorResponse(
              409,
              "Policy period overlaps an existing policy for this organization.",
            ),
          );
      }
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(500, "Internal server error."),
        );
    }
  }

  static async updatePolicy(req, res) {
    try {
      const orgId = resolveOrgId(req);
      const { id } = req.params;
      const { period, year_start, year_end, leave_settings } = req.body;

      if (
        !orgId ||
        !id ||
        !period ||
        !year_start ||
        !year_end ||
        !Array.isArray(leave_settings)
      ) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "orgId, id, period, year_start, year_end and leave_settings[] are required.",
            ),
          );
      }

      const updated = await LeavePolicyService.updatePolicy(id, orgId, {
        period,
        year_start,
        year_end,
        leave_settings,
      });
      return res
        .status(200)
        .json(
          ErrorHandler.generateSuccessResponse(200, "Policy updated.", updated),
        );
    } catch (err) {
      console.error("updatePolicy:", err && (err.stack || err.message || err));
      if (err && err.code === "OVERLAP") {
        return res
          .status(409)
          .json(
            ErrorHandler.generateErrorResponse(
              409,
              "Updated policy period overlaps another policy for this organization.",
            ),
          );
      }
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(500, "Internal server error."),
        );
    }
  }

  static async deletePolicy(req, res) {
    try {
      const orgId = resolveOrgId(req);
      const { id } = req.params;

      if (!orgId || !id) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "orgId and policy ID are required.",
            ),
          );
      }

      await LeavePolicyService.deletePolicy(id, orgId);
      return res
        .status(200)
        .json(ErrorHandler.generateSuccessResponse(200, "Policy deleted."));
    } catch (err) {
      console.error("deletePolicy:", err && (err.stack || err.message || err));
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(500, "Internal server error."),
        );
    }
  }

  // === LEAVE BALANCE ===
  static async getLeaveBalanceHandler(req, res) {
    try {
      const orgId = resolveOrgId(req);
      // accept param, query or body for employee id (defensive)
      const employeeId =
        req.params?.employeeId ||
        req.query?.employeeId ||
        req.body?.employeeId ||
        null;

      if (!orgId || !employeeId) {
        // helpful debug fields so callers can see what arrived
        const debug = {
          receivedHeaders: {
            "x-org-id":
              req.headers?.["x-org-id"] || req.headers?.["x_org_id"] || null,
            "x-employee-id":
              req.headers?.["x-employee-id"] ||
              req.headers?.["x_employee_id"] ||
              null,
          },
          params: req.params || {},
          query: req.query || {},
          bodyKeys: req.body ? Object.keys(req.body) : [],
        };
        console.warn(
          "[getLeaveBalanceHandler] missing orgId/employeeId for request",
          debug,
        );
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "orgId and employeeId are required.",
            ),
          );
      }

      // call service
      const data = await LeavePolicyService.getLeaveBalance(employeeId, orgId);

      // ensure array canonical response
      const arr = Array.isArray(data) ? data : (data && data.data) || [];
      return res
        .status(200)
        .json(
          ErrorHandler.generateSuccessResponse(
            200,
            "Leave balance fetched.",
            arr,
          ),
        );
    } catch (err) {
      console.error(
        "[getLeaveBalanceHandler] error:",
        err && (err.stack || err.message || err),
      );
      const devMessage =
        process.env.NODE_ENV === "production"
          ? "Internal server error."
          : (err && (err.message || err.stack)) || "Internal server error.";
      return res
        .status(500)
        .json(ErrorHandler.generateErrorResponse(500, devMessage));
    }
  }

  static async getMonthlyLOPHandler(req, res) {
    try {
      const orgId = resolveOrgId(req);
      const { employeeId } = req.params;

      if (!orgId || !employeeId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "orgId and employeeId are required.",
            ),
          );
      }

      const now = new Date();
      const month = parseInt(req.query?.month, 10) || now.getMonth() + 1;
      const year = parseInt(req.query?.year, 10) || now.getFullYear();

      const data = await LeavePolicyService.getMonthlyLOP(
        employeeId,
        month,
        year,
        orgId,
      );
      return res
        .status(200)
        .json(
          ErrorHandler.generateSuccessResponse(
            200,
            "Monthly LOP fetched.",
            data,
          ),
        );
    } catch (err) {
      console.error(
        "getMonthlyLOPHandler:",
        err && (err.stack || err.message || err),
      );
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(500, "Internal server error."),
        );
    }
  }

  static async computeMonthlyLOPHandler(req, res) {
    try {
      const orgId = resolveOrgId(req);
      const { employeeId } = req.params;

      if (!orgId || !employeeId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "orgId and employeeId are required.",
            ),
          );
      }

      const now = new Date();
      const month =
        parseInt(req.body?.month || req.query?.month, 10) || now.getMonth() + 1;
      const year =
        parseInt(req.body?.year || req.query?.year, 10) || now.getFullYear();

      const data = await LeavePolicyService.computeAndStoreMonthlyLOP(
        employeeId,
        month,
        year,
        orgId,
      );
      return res
        .status(200)
        .json(
          ErrorHandler.generateSuccessResponse(
            200,
            "Monthly LOP computed & stored.",
            data,
          ),
        );
    } catch (err) {
      console.error(
        "computeMonthlyLOPHandler:",
        err && (err.stack || err.message || err),
      );
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(500, "Internal server error."),
        );
    }
  }
}

module.exports = LeavePolicyHandler;
