const ErrorHandler = require("../utils/errorHandler");

const AUTH_DIAG_ENABLED = process.env.AUTH_DIAGNOSTICS === "true";

const PUBLIC_PATHS = [
  "/me",
  "/orgs",
  "/login",
  "/auto-login/",
  "/forgot-password",
  "/password-reset",
  "/vapidPublicKey",
  "/subscribe",
  "/check-subscription",
  "/vendors/public-registration",
  "/vendors/public-registration/login",
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

  if (p.startsWith("/auto-login/")) return true;

  return PUBLIC_PREFIXES.some((prefix) => p.startsWith(prefix));
}

function safePath(req) {
  const p = String(req.path || "").split("?")[0];

  return p.startsWith("/auto-login/") ? "/auto-login/:token" : p;
}

module.exports = function apiKeyMiddleware(req, res, next) {
  try {
    const diagnosticRequest = AUTH_DIAG_ENABLED && Boolean(req.authTraceId);

    const log = (stage, details = {}) => {
      if (!diagnosticRequest) return;

      console.info(
        `[AUTH-DIAG][API-KEY][${stage}]`,
        JSON.stringify({
          traceId: req.authTraceId,
          method: req.method,
          path: safePath(req),
          ...details,
        }),
      );
    };

    if (req.method === "OPTIONS") {
      log("OPTIONS-BYPASS");
      return next();
    }

    if (isPublicPath(req)) {
      log("PUBLIC-PATH-BYPASS");
      return next();
    }

    if (req.session && req.session.user) {
      req.authenticatedBy = "session";
      log("SESSION-ACCEPTED");
      return next();
    }

    const apiKey = req.header("x-api-key");
    const validApiKey = process.env.X_API_KEY;

    if (apiKey && validApiKey && apiKey === validApiKey) {
      req.authenticatedBy = "api-key";
      log("API-KEY-ACCEPTED");
      return next();
    }

    console.warn(
      "[apiKeyMiddleware] Rejecting request",
      JSON.stringify({
        traceId: req.authTraceId || null,
        method: req.method,
        path: safePath(req),
        sessionUserPresent: Boolean(req.session?.user),
        apiKeyHeaderPresent: Boolean(apiKey),
        serverApiKeyConfigured: Boolean(validApiKey),
      }),
    );

    const errorResponse = ErrorHandler.generateErrorResponse(
      403,
      "Forbidden: Invalid or missing credentials",
    );

    return res.status(403).json(errorResponse);
  } catch (err) {
    console.error("[apiKeyMiddleware] error:", err?.message || err);

    return res
      .status(500)
      .json(ErrorHandler.generateErrorResponse(500, "Internal server error"));
  }
};
