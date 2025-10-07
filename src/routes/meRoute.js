const express = require("express");
const router = express.Router();

// GET /me
router.get("/me", (req, res) => {
  console.log("/me: cookies:", req.headers.cookie);
  console.log("/me: session:", req.session);
  try {
    // if there's no session user, return 401
    if (!req.session || !req.session.user) {
      return res
        .status(401)
        .json({ status: "error", code: 401, message: "Not authenticated" });
    }

    // return the same shape your frontend expects: { status, code, message: { ... } }
    // message should include role, name, org_id, gender, dashboard, sidebarMenu, etc.
    const sessUser = req.session.user;

    // normalize naming to match login response, e.g. org_id / dashboard etc.
    const payload = {
      role: sessUser.role,
      name: sessUser.name,
      org_id: sessUser.orgId,
      gender: sessUser.gender ?? null,
      dashboard: sessUser.dashboard ?? {},
      sidebarMenu: sessUser.sidebarMenu ?? [],
      // optionally include email/employeeId
      email: sessUser.email ?? null,
      employeeId: sessUser.employeeId ?? null,
      // any other raw data you want to expose:
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
