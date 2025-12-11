const ErrorHandler = require("../utils/errorHandler");

const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/password-reset",
  "/vapidPublicKey",
  "/subscribe",
  "/check-subscription",
  "/health",
  "/favicon.ico",
  "/api/socket.io",
  "/socket.io",
];

const PUBLIC_PREFIXES = [
  "/public",
  "/letterheadfiles",
  "/api/socket.io",
  "/socket.io",
];

function isPublicPath(req) {
  const p = req.path || "";
  if (PUBLIC_PATHS.includes(p)) return true;
  for (const prefix of PUBLIC_PREFIXES) {
    if (p.startsWith(prefix)) return true;
  }
  return false;
}

module.exports = function apiKeyMiddleware(req, res, next) {
  try {
    if (req.method === "OPTIONS") return next();
    if (isPublicPath(req)) return next();

    if (req.session && req.session.user) {
      req.authenticatedBy = "session";
      return next();
    }

    const apiKey = req.header("x-api-key");
    const validApiKey = process.env.X_API_KEY;
    if (apiKey && validApiKey && apiKey === validApiKey) {
      req.authenticatedBy = "api-key";
      return next();
    }

    console.warn(
      `[apiKeyMiddleware] Rejecting request ${req.method} ${req.originalUrl} - no valid session or x-api-key`
    );

    const errorResponse = ErrorHandler.generateErrorResponse(
      403,
      "Forbidden: Invalid or missing credentials"
    );
    return res.status(403).json(errorResponse);
  } catch (err) {
    console.error(
      "apiKeyMiddleware error:",
      err && err.message ? err.message : err
    );
    return res
      .status(500)
      .json(ErrorHandler.generateErrorResponse(500, "Internal server error"));
  }
};
