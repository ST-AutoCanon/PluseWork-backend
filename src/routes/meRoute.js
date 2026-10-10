const express = require("express");
const router = express.Router();
const employeeService = require("../services/employeeService");

const AUTH_DIAG_ENABLED = process.env.AUTH_DIAGNOSTICS === "true";

router.get("/me", async (req, res) => {
  const traceId = req.authTraceId || null;

  // Log cookie names only. Never log actual cookie values.
  const incomingCookieNames = String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim().split("=")[0])
    .filter(Boolean);

  const sidCookieSent = incomingCookieNames.includes("sid");

  // STEP 1: Request reached /me.
  if (AUTH_DIAG_ENABLED) {
    console.info("[AUTH-DIAG][ME][START]", {
      traceId,
      method: req.method,
      origin: req.headers.origin || null,
      cookieHeaderPresent: Boolean(req.headers.cookie),
      cookieNames: incomingCookieNames,
      sidCookieSent,
      sessionObjectAvailable: Boolean(req.session),
      sessionIDAvailable: Boolean(req.sessionID),
      sessionUserPresent: Boolean(req.session?.user),
    });
  }

  try {
    // STEP 2: Verify the authenticated session.
    if (!req.session || !req.session.user) {
      if (AUTH_DIAG_ENABLED) {
        console.warn("[AUTH-DIAG][ME][UNAUTHENTICATED]", {
          traceId,
          sidCookieSent,
          sessionObjectAvailable: Boolean(req.session),
          sessionIDAvailable: Boolean(req.sessionID),
          sessionUserPresent: false,
          reason: !sidCookieSent
            ? "Session cookie sid was not sent"
            : "Session user was not found",
        });
      }

      return res.status(401).json({
        status: "error",
        code: 401,
        message: "Not authenticated",
      });
    }

    const sessUser = req.session.user;

    if (AUTH_DIAG_ENABLED) {
      console.info("[AUTH-DIAG][ME][SESSION-VALID]", {
        traceId,
        sessionUserPresent: true,
        sessionHasEmployeeId: Boolean(sessUser.employeeId || sessUser.id),
        sessionHasOrgId: Boolean(sessUser.orgId || sessUser.org_id),
        sessionRole: sessUser.role || null,
      });
    }

    // STEP 3: Prepare the existing profile information.
    let photoUrl = sessUser.photoUrl ?? sessUser.photo_url ?? null;

    let department = sessUser.department ?? null;
    let orgPrefix = sessUser.orgPrefix ?? null;

    let joiningDate = sessUser.joining_date ?? sessUser.joiningDate ?? null;

    // STEP 4: Refresh profile information from the database.
    if (sessUser.employeeId && sessUser.orgId) {
      try {
        if (AUTH_DIAG_ENABLED) {
          console.info("[AUTH-DIAG][ME][PROFILE-REFRESH-START]", {
            traceId,
            employeeIdAvailable: true,
            orgIdAvailable: true,
          });
        }

        const profile = await employeeService.getFullEmployee(
          sessUser.employeeId,
          sessUser.orgId,
        );

        if (profile) {
          if (profile.photo_url) {
            photoUrl = profile.photo_url;
          }

          if (profile.department) {
            department = profile.department;
          }

          if (profile.joining_date) {
            joiningDate = profile.joining_date;
          }

          // Keep session information synchronized.
          req.session.user.photo_url = photoUrl;
          req.session.user.photoUrl = photoUrl;
          req.session.user.department = department;
          req.session.user.joining_date = joiningDate;
          req.session.user.joiningDate = joiningDate;
        }

        if (AUTH_DIAG_ENABLED) {
          console.info("[AUTH-DIAG][ME][PROFILE-REFRESH-SUCCESS]", {
            traceId,
            profileFound: Boolean(profile),
            departmentAvailable: Boolean(department),
            joiningDateAvailable: Boolean(joiningDate),
            photoUrlAvailable: Boolean(photoUrl),
          });
        }
      } catch (err) {
        // A profile-refresh failure does not invalidate
        // an otherwise valid login session.
        if (AUTH_DIAG_ENABLED) {
          console.warn("[AUTH-DIAG][ME][PROFILE-REFRESH-FAILED]", {
            traceId,
            error: err?.message || "Unknown error",
          });
        }
      }
    } else if (AUTH_DIAG_ENABLED) {
      console.warn("[AUTH-DIAG][ME][PROFILE-REFRESH-SKIPPED]", {
        traceId,
        employeeIdAvailable: Boolean(sessUser.employeeId),
        orgIdAvailable: Boolean(sessUser.orgId),
      });
    }

    // STEP 5: Construct the existing response payload.
    const payload = {
      role: sessUser.role,
      name: sessUser.name,
      org_id: sessUser.orgId,
      orgPrefix,
      gender: sessUser.gender ?? null,
      photo_url: photoUrl,
      photoUrl,
      department_id: sessUser.department_id ?? null,
      department,
      joining_date: joiningDate,
      joiningDate,
      dashboard: {
        ...(sessUser.dashboard ?? {}),
        department,
      },
      sidebarMenu: sessUser.sidebarMenu ?? [],
      email: sessUser.email ?? null,
      employeeId: sessUser.employeeId ?? null,
      raw: sessUser,
    };

    // STEP 6: Authentication succeeded.
    if (AUTH_DIAG_ENABLED) {
      console.info("[AUTH-DIAG][ME][SUCCESS]", {
        traceId,
        status: 200,
        sessionUserPresent: true,
        sessionHasEmployeeId: Boolean(sessUser.employeeId || sessUser.id),
        sessionHasOrgId: Boolean(sessUser.orgId || sessUser.org_id),
      });
    }

    return res.status(200).json({
      status: "success",
      code: 200,
      message: payload,
    });
  } catch (err) {
    // STEP 7: Unexpected /me handler error.
    console.error("[AUTH-DIAG][ME][ERROR]", {
      traceId,
      error: err?.message || "Unknown error",
    });

    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Internal server error",
    });
  }
});

module.exports = router;
