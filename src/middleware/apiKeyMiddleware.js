const ErrorHandler = require("../utils/errorHandler");

/**
 * Middleware to validate x-api-key in the request header.
 * @param {Object} req - Request object.
 * @param {Object} res - Response object.
 * @param {Function} next - Next middleware function.
 */
const validateApiKey = (req, res, next) => {
  const apiKey = req.header("x-api-key");
  const validApiKey = process.env.X_API_KEY;

  // Check if API key is provided and is valid
  if (!apiKey || apiKey !== validApiKey) {
    const errorResponse = ErrorHandler.generateErrorResponse(
      403,
      "Forbidden: Invalid API key"
    );
    return res.status(403).json(errorResponse);
  }

  next();
};

module.exports = validateApiKey;
