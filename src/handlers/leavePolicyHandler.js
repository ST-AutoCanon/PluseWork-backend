// handlers/leavePolicyHandler.js
const LeavePolicyService = require("../services/leavePolicyService");
const ErrorHandler = require("../utils/errorHandler");

const resolveOrgId = (req) =>
  req.headers?.["x-org-id"] ||
  req.headers?.["x_org_id"] ||
  req.query?.orgId ||
  req.query?.org_id ||
  req.body?.orgId ||
  req.body?.org_id ||
  (req.user && (req.user.orgId || req.user.org_id)) ||
  null;

class LeavePolicyHandler {
  static async autoExtendHandler(req, res) {
    try {
      const actorFromHeader = req.headers["x-employee-id"];
      const actorId = actorFromHeader || req.body?.actorId || "system";
      const orgId = resolveOrgId(req);

      if (!orgId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "Missing orgId (x-org-id header or orgId in body/query)."
            )
          );
      }

      const extensionDays = Number(req.body?.extensionDays) || 90;

      const created = await LeavePolicyService.autoExtendRecentPolicies(
        extensionDays,
        actorId,
        orgId
      );

      return res.json({
        success: true,
        created,
      });
    } catch (err) {
      console.error("[autoExtendHandler] error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to auto-extend policies." });
    }
  }

  static async getAllPolicies(req, res) {
    try {
      const orgId = resolveOrgId(req);
      if (!orgId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "Missing orgId (x-org-id header or orgId in body/query)."
            )
          );
      }

      const policies = await LeavePolicyService.getAllPolicies(orgId);
      return res
        .status(200)
        .json(
          ErrorHandler.generateSuccessResponse(
            200,
            "Policies fetched.",
            policies
          )
        );
    } catch (err) {
      console.error("getAllPolicies:", err);
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(500, "Internal server error.")
        );
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
              "orgId, period, year_start, year_end and leave_settings[] are required."
            )
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
            newPolicy
          )
        );
    } catch (err) {
      console.error("createPolicy:", err);
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(500, "Internal server error.")
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
              "orgId, id, period, year_start, year_end and leave_settings[] are required."
            )
          );
      }

      await LeavePolicyService.updatePolicy(id, orgId, {
        period,
        year_start,
        year_end,
        leave_settings,
      });

      return res
        .status(200)
        .json(ErrorHandler.generateSuccessResponse(200, "Policy updated."));
    } catch (err) {
      console.error("updatePolicy:", err);
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(500, "Internal server error.")
        );
    }
  }

  static async deletePolicy(req, res) {
    try {
      const orgId = resolveOrgId(req);
      const { id } = req.params;
      if (!orgId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "Missing orgId (x-org-id header or orgId in body/query)."
            )
          );
      }
      if (!id) {
        return res
          .status(400)
          .json(ErrorHandler.generateErrorResponse(400, "Policy ID required."));
      }
      await LeavePolicyService.deletePolicy(id, orgId);
      return res
        .status(200)
        .json(ErrorHandler.generateSuccessResponse(200, "Policy deleted."));
    } catch (err) {
      console.error("deletePolicy:", err);
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(500, "Internal server error.")
        );
    }
  }

  static async getLeaveBalanceHandler(req, res) {
    try {
      const orgId = resolveOrgId(req);
      const { employeeId } = req.params;
      if (!orgId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "Missing orgId (x-org-id header or orgId in body/query)."
            )
          );
      }
      if (!employeeId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(400, "Employee ID is required.")
          );
      }
      const data = await LeavePolicyService.getLeaveBalance(employeeId, orgId);
      return res
        .status(200)
        .json(
          ErrorHandler.generateSuccessResponse(
            200,
            "Leave balance fetched.",
            data
          )
        );
    } catch (err) {
      console.error("getLeaveBalanceHandler:", err);
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(500, "Internal server error.")
        );
    }
  }

  static async getMonthlyLOPHandler(req, res) {
    try {
      const orgId = resolveOrgId(req);
      const { employeeId } = req.params;
      if (!orgId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "Missing orgId (x-org-id header or orgId in body/query)."
            )
          );
      }
      if (!employeeId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(400, "Employee ID is required.")
          );
      }

      const now = new Date();
      const month = req.query.month
        ? parseInt(req.query.month, 10)
        : now.getMonth() + 1;
      const year = req.query.year
        ? parseInt(req.query.year, 10)
        : now.getFullYear();

      const data = await LeavePolicyService.getMonthlyLOP(
        employeeId,
        month,
        year,
        orgId
      );

      return res
        .status(200)
        .json(
          ErrorHandler.generateSuccessResponse(
            200,
            "Monthly LOP fetched.",
            data
          )
        );
    } catch (err) {
      console.error("getMonthlyLOPHandler:", err);
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(500, "Internal server error.")
        );
    }
  }

  static async computeMonthlyLOPHandler(req, res) {
    try {
      const orgId = resolveOrgId(req);
      const { employeeId } = req.params;
      if (!orgId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "Missing orgId (x-org-id header or orgId in body/query)."
            )
          );
      }
      if (!employeeId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(400, "Employee ID is required.")
          );
      }

      const now = new Date();
      const month =
        req.body?.month || req.query?.month
          ? parseInt(req.body?.month || req.query?.month, 10)
          : now.getMonth() + 1;
      const year =
        req.body?.year || req.query?.year
          ? parseInt(req.body?.year || req.query?.year, 10)
          : now.getFullYear();

      const data = await LeavePolicyService.computeAndStoreMonthlyLOP(
        employeeId,
        month,
        year,
        orgId
      );

      return res
        .status(200)
        .json(
          ErrorHandler.generateSuccessResponse(
            200,
            "Monthly LOP computed & stored.",
            data
          )
        );
    } catch (err) {
      console.error("computeMonthlyLOPHandler:", err);
      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(500, "Internal server error.")
        );
    }
  }
}

module.exports = LeavePolicyHandler;
