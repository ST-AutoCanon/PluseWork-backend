const crypto = require("crypto");
const moment = require("moment");

const CommonLoginService = require("../services/commonLoginService");
const ErrorHandler = require("../utils/errorHandler");
const { redisClient } = require("../lib/sessionStore");

class CommonLoginHandler {
  // ============================================================
  // COMMON LOGIN
  // ============================================================

  static async login(req, res) {
    try {
      const {
        email,
        password,
        orgId,
        deviceName,
        deviceType,
        browser,
        location,
      } = req.body || {};

      if (!email || !password || !orgId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "email, password and orgId are required",
            ),
          );
      }

      console.log(
        "[CommonLogin] Login attempt:",
        {
          email,
          orgId,
          deviceName,
          deviceType,
          browser,
          location,
        },
      );

      // --------------------------------------------------------
      // FIND COMMON LOGIN ACCOUNT
      // --------------------------------------------------------

      const user =
        await CommonLoginService.getLoginByEmail(
          orgId,
          email,
        );

      if (!user) {
        return res
          .status(401)
          .json(
            ErrorHandler.generateErrorResponse(
              401,
              "Invalid credentials",
            ),
          );
      }

      // --------------------------------------------------------
      // ACTIVE CHECK
      // --------------------------------------------------------

      if (!user.is_active) {
        return res
          .status(403)
          .json(
            ErrorHandler.generateErrorResponse(
              403,
              "Account is inactive. Please contact your administrator.",
            ),
          );
      }

      // --------------------------------------------------------
      // PASSWORD CHECK
      // --------------------------------------------------------

      const validPassword =
        await CommonLoginService.verifyPassword(
          password,
          user.password_hash,
        );

      if (!validPassword) {
        return res
          .status(401)
          .json(
            ErrorHandler.generateErrorResponse(
              401,
              "Invalid credentials",
            ),
          );
      }

      // --------------------------------------------------------
      // ORGANIZATION CHECK
      // --------------------------------------------------------

      const org =
        await CommonLoginService.getOrganization(
          orgId,
        );

      if (!org) {
        return res
          .status(404)
          .json(
            ErrorHandler.generateErrorResponse(
              404,
              "Organization not found",
            ),
          );
      }

      // --------------------------------------------------------
      // ORGANIZATION EXPIRY
      // --------------------------------------------------------

      if (org.end_date) {
        const today = moment().startOf("day");
        const orgEnd = moment(org.end_date).endOf("day");

        if (orgEnd.isBefore(today, "day")) {
          return res
            .status(403)
            .json(
              ErrorHandler.generateErrorResponse(
                403,
                "Your subscription ended. To renew, please contact Administrator.",
              ),
            );
        }
      }

      // --------------------------------------------------------
      // CREATE COMMON SESSION
      // --------------------------------------------------------

      req.session.lastActive = Date.now();

      req.session.commonUser = {
        id: user.id,
        employeeId: user.employee_id,
        orgId: user.org_id,
        name: user.name,
        email: user.email,
        location: user.location || null,
        pincode: user.pincode || null,
        isCommonLogin: true,
        loginType: "common",
      };

      // --------------------------------------------------------
      // SAVE DEVICE INFORMATION
      // --------------------------------------------------------

      await CommonLoginService.saveDevice({
        loginId: user.id,
        orgId: user.org_id,
        employeeId: user.employee_id,
        deviceName,
        deviceType,
        browser,
        ipAddress:
          req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
          req.socket?.remoteAddress ||
          req.ip ||
          null,
        location,
      });

      // --------------------------------------------------------
      // REDIS SESSION TRACKING
      // --------------------------------------------------------

      if (
        redisClient &&
        typeof redisClient.sadd === "function"
      ) {
        redisClient
          .sadd(
            `common_user_sessions:${user.id}`,
            req.sessionID,
          )
          .catch((err) => {
            console.error(
              "[CommonLogin] Redis session error:",
              err,
            );
          });

        redisClient
          .publish(
            "auth:changes",
            JSON.stringify({
              type: "common_login",
              userId: user.id,
              employeeId: user.employee_id,
              orgId: user.org_id,
            }),
          )
          .catch((err) => {
            console.error(
              "[CommonLogin] Redis publish error:",
              err,
            );
          });
      }

      // --------------------------------------------------------
      // SAVE SESSION
      // --------------------------------------------------------

      req.session.save((err) => {
        if (err) {
          console.error(
            "[CommonLogin] Session save error:",
            err,
          );

          return res
            .status(500)
            .json(
              ErrorHandler.generateErrorResponse(
                500,
                "Failed to create login session",
              ),
            );
        }

        return res.status(200).json({
          status: "success",
          code: 200,
          message: {
            id: user.id,
            employeeId: user.employee_id,
            name: user.name,
            email: user.email,
            org_id: user.org_id,
            location: user.location || null,
            pincode: user.pincode || null,
            isCommonLogin: true,
            loginType: "common",
          },
        });
      });
    } catch (err) {
      console.error(
        "[CommonLogin] Login error:",
        err,
      );

      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(
            500,
            "Internal server error",
          ),
        );
    }
  }

  // ============================================================
  // LOGOUT
  // ============================================================

  static async logout(req, res) {
    try {
      const commonUser =
        req.session?.commonUser;

      const commonUserId =
        commonUser?.id;

      const sessionId =
        req.sessionID;

      req.session.destroy(async (err) => {
        if (err) {
          console.error(
            "[CommonLogin] Session destroy error:",
            err,
          );

          return res
            .status(500)
            .json(
              ErrorHandler.generateErrorResponse(
                500,
                "Failed to logout cleanly",
              ),
            );
        }

        try {
          if (
            commonUserId &&
            redisClient &&
            typeof redisClient.srem === "function"
          ) {
            await redisClient.srem(
              `common_user_sessions:${commonUserId}`,
              sessionId,
            );

            await redisClient.publish(
              "auth:changes",
              JSON.stringify({
                type: "common_logout",
                userId: commonUserId,
              }),
            );
          }
        } catch (cleanupErr) {
          console.error(
            "[CommonLogin] Redis cleanup error:",
            cleanupErr,
          );
        }

        res.clearCookie("sid", {
          httpOnly: true,
          sameSite: "lax",
          secure:
            process.env.NODE_ENV === "production",
        });

        return res.status(200).json({
          status: "success",
          code: 200,
          message: "Logged out",
        });
      });
    } catch (err) {
      console.error(
        "[CommonLogin] Logout error:",
        err,
      );

      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(
            500,
            "Internal server error",
          ),
        );
    }
  }

  // ============================================================
  // CURRENT COMMON USER
  // ============================================================

  static async me(req, res) {
    try {
      const commonUser =
        req.session?.commonUser;

      if (!commonUser) {
        return res
          .status(401)
          .json(
            ErrorHandler.generateErrorResponse(
              401,
              "Unauthorized",
            ),
          );
      }

      return res.status(200).json({
        status: "success",
        code: 200,
        message: commonUser,
      });
    } catch (err) {
      console.error(
        "[CommonLogin] Me error:",
        err,
      );

      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(
            500,
            "Internal server error",
          ),
        );
    }
  }

  // ============================================================
  // CREATE COMMON LOGIN
  // ============================================================

// ============================================================
// CREATE COMMON LOGIN
// ============================================================


  // ============================================================
  // CREATE COMMON LOGIN
  // Employee ID is optional
  // ============================================================

  static async create(req, res) {
    try {
      const {
        orgId: bodyOrgId,
        employeeId,
        name,
        email,
        location,
        pincode,
        password,
        isActive = true,
      } = req.body || {};

      // Resolve organization ID from body or headers.
      const rawOrgId =
        bodyOrgId ||
        req.headers["x-org-id"] ||
        req.headers["x_org_id"] ||
        req.headers["org-id"] ||
        req.headers["orgid"];

      const orgId = String(rawOrgId || "").trim();

      if (!orgId || !/^\d+$/.test(orgId)) {
        return res.status(400).json(
          ErrorHandler.generateErrorResponse(
            400,
            "A valid organization ID is required"
          )
        );
      }

      if (!name || !String(name).trim()) {
        return res.status(400).json(
          ErrorHandler.generateErrorResponse(400, "Name is required")
        );
      }

      if (!email || !String(email).trim()) {
        return res.status(400).json(
          ErrorHandler.generateErrorResponse(400, "Email is required")
        );
      }

      if (!location || !String(location).trim()) {
        return res.status(400).json(
          ErrorHandler.generateErrorResponse(400, "Location is required")
        );
      }

      if (!/^\d{6}$/.test(String(pincode || "").trim())) {
        return res.status(400).json(
          ErrorHandler.generateErrorResponse(
            400,
            "Pincode must contain exactly 6 digits"
          )
        );
      }

      if (!password || password.length < 6) {
        return res.status(400).json(
          ErrorHandler.generateErrorResponse(
            400,
            "Password must contain at least 6 characters"
          )
        );
      }

      const normalizedName = String(name).trim();
      const normalizedEmail = String(email).trim();
      const normalizedLocation = String(location).trim();
      const normalizedPincode = String(pincode).trim();

      // Check email uniqueness within this organization.
      const existing = await CommonLoginService.getLoginByEmail(
        orgId,
        normalizedEmail
      );

      if (existing) {
        return res.status(409).json(
          ErrorHandler.generateErrorResponse(
            409,
            "A common login with this email already exists"
          )
        );
      }

      // Employee ID is optional and is stored as NULL when omitted.
      const result = await CommonLoginService.createCommonLogin({
        orgId,
        employeeId: employeeId
          ? String(employeeId).trim() || null
          : null,
        name: normalizedName,
        email: normalizedEmail,
        location: normalizedLocation,
        pincode: normalizedPincode,
        password,
        isActive: isActive !== false,
      });

      return res.status(201).json({
        status: "success",
        code: 201,
        message: {
          ...result,
          isActive: isActive !== false,
        },
      });
    } catch (err) {
      console.error("[CommonLogin] Create error:", err);

      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json(
          ErrorHandler.generateErrorResponse(
            409,
            "A common login with this email already exists"
          )
        );
      }

      return res.status(500).json(
        ErrorHandler.generateErrorResponse(
          500,
          err.message || "Internal server error"
        )
      );
    }
  }


static async list(req, res) {
  try {
    const orgId = String(
      req.query.orgId ||
      req.headers["x-org-id"] ||
      req.headers["x_org_id"] ||
      ""
    ).trim();

    if (!/^\d+$/.test(orgId)) {
      return res.status(400).json({
        status: "error",
        message: "A valid organization ID is required",
      });
    }

    const records =
      await CommonLoginService.getAllCommonLogins(orgId);

    return res.status(200).json({
      status: "success",
      message: records,
    });
  } catch (error) {
    console.error("[CommonLogin] List error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to load common logins",
    });
  }
}

static async getById(req, res) {
  try {
    const { id } = req.params;

    const orgId = String(
      req.query.orgId ||
      req.headers["x-org-id"] ||
      req.headers["x_org_id"] ||
      ""
    ).trim();

    if (!/^\d+$/.test(orgId) || !/^\d+$/.test(String(id))) {
      return res.status(400).json({
        status: "error",
        message: "Valid record and organization IDs are required",
      });
    }

    const record =
      await CommonLoginService.getCommonLoginById(id, orgId);

    if (!record) {
      return res.status(404).json({
        status: "error",
        message: "Common login not found",
      });
    }

    return res.status(200).json({
      status: "success",
      message: record,
    });
  } catch (error) {
    console.error("[CommonLogin] Get record error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to load common login",
    });
  }
}


  // ============================================================
  // UPDATE
  // ============================================================

  static async update(req, res) {
    try {
      const { id } = req.params;

      const {
        orgId,
        name,
        email,
        password,
        location,
        pincode,
        isActive,
      } = req.body || {};

      if (!id || !orgId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "id and orgId are required",
            ),
          );
      }

      await CommonLoginService.updateCommonLogin({
        id,
        orgId,
        name,
        email,
        password,
        location,
        pincode,
        isActive,
      });

      return res.status(200).json({
        status: "success",
        code: 200,
        message: "Common login updated successfully",
      });
    } catch (err) {
      console.error(
        "[CommonLogin] Update error:",
        err,
      );

      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(
            500,
            "Internal server error",
          ),
        );
    }
  }

  // ============================================================
  // DEVICES
  // ============================================================

  static async devices(req, res) {
    try {
      const {
        loginId,
        orgId,
      } = req.query;

      if (!loginId || !orgId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "loginId and orgId are required",
            ),
          );
      }

      const devices =
        await CommonLoginService.getDevices(
          loginId,
          orgId,
        );

      return res.status(200).json({
        status: "success",
        code: 200,
        message: devices,
      });
    } catch (err) {
      console.error(
        "[CommonLogin] Devices error:",
        err,
      );

      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(
            500,
            "Internal server error",
          ),
        );
    }
  }

  // ============================================================
  // DISABLE
  // ============================================================

  static async disable(req, res) {
    try {
      const { id } = req.params;
      const { orgId } = req.body || {};

      if (!id || !orgId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "id and orgId are required",
            ),
          );
      }

      await CommonLoginService.disableLogin(
        id,
        orgId,
      );

      return res.status(200).json({
        status: "success",
        code: 200,
        message: "Common login disabled",
      });
    } catch (err) {
      console.error(
        "[CommonLogin] Disable error:",
        err,
      );

      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(
            500,
            "Internal server error",
          ),
        );
    }
  }

  // ============================================================
  // ENABLE
  // ============================================================

  static async enable(req, res) {
    try {
      const { id } = req.params;
      const { orgId } = req.body || {};

      if (!id || !orgId) {
        return res
          .status(400)
          .json(
            ErrorHandler.generateErrorResponse(
              400,
              "id and orgId are required",
            ),
          );
      }

      await CommonLoginService.enableLogin(
        id,
        orgId,
      );

      return res.status(200).json({
        status: "success",
        code: 200,
        message: "Common login enabled",
      });
    } catch (err) {
      console.error(
        "[CommonLogin] Enable error:",
        err,
      );

      return res
        .status(500)
        .json(
          ErrorHandler.generateErrorResponse(
            500,
            "Internal server error",
          ),
        );
    }
  }
}

module.exports = CommonLoginHandler;