const express = require("express");
const router = express.Router();
const employeeService = require("../services/employeeService");

router.get("/me", async (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      return res
        .status(401)
        .json({ status: "error", code: 401, message: "Not authenticated" });
    }

    const sessUser = req.session.user;

    // Attempt to refresh the session user information from the latest profile data.
    // This ensures that updates (e.g., profile photo changes) are reflected immediately.
    let photoUrl = sessUser.photoUrl ?? sessUser.photo_url ?? null;
    let department = sessUser.department ?? null;
    let orgPrefix = sessUser.orgPrefix ?? null;

    if (sessUser.employeeId && sessUser.orgId) {
      try {
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

          // keep session in sync for subsequent requests
          req.session.user.photo_url = photoUrl;
          req.session.user.photoUrl = photoUrl;
          req.session.user.department = department;
        }
      } catch (err) {
        // If fetching profile fails, fall back to what is in session
      }
    }

    const payload = {
      role: sessUser.role,
      name: sessUser.name,
      org_id: sessUser.orgId,
      orgPrefix,
      gender: sessUser.gender ?? null,
      photo_url: photoUrl,
      photoUrl: photoUrl,
      department_id: sessUser.department_id ?? null,
      department,
      dashboard: {
        ...(sessUser.dashboard ?? {}),
        department,
      },
      sidebarMenu: sessUser.sidebarMenu ?? [],
      email: sessUser.email ?? null,
      employeeId: sessUser.employeeId ?? null,
      raw: sessUser,
    };

    return res
      .status(200)
      .json({ status: "success", code: 200, message: payload });
  } catch (err) {
    console.error("GET /me error:", err);
    return res
      .status(500)
      .json({ status: "error", code: 500, message: "Internal server error" });
  }
});

module.exports = router;
