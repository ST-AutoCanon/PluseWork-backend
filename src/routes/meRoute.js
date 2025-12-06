const express = require("express");
const router = express.Router();

router.get("/me", (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      return res
        .status(401)
        .json({ status: "error", code: 401, message: "Not authenticated" });
    }

    const sessUser = req.session.user;

    const payload = {
      role: sessUser.role,
      name: sessUser.name,
      org_id: sessUser.orgId,
      gender: sessUser.gender ?? null,
      dashboard: sessUser.dashboard ?? {},
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
