module.exports = (req, res, next) => {
  const idleLimit = 5 * 60 * 1000;

  const publicPaths = ["/login", "/orgs", "/forgot-password"];

  if (publicPaths.includes(req.path) || req.path.startsWith("/auto-login/")) {
    return next();
  }

  if (!req.session) {
    return next();
  }

  if (!req.session.lastActive) {
    req.session.lastActive = Date.now();
    return next();
  }

  const now = Date.now();
  const idleTime = now - req.session.lastActive;

  if (idleTime > idleLimit) {
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destruction error:", err);
        return res.status(500).json({
          status: "error",
          code: 500,
          message: "Internal Server Error during logout.",
        });
      }

      return res.status(401).json({
        status: "error",
        code: 401,
        message: "Session expired due to inactivity.",
      });
    });
  } else {
    req.session.lastActive = now;
    next();
  }
};
