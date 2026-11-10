/**
 * Centralized error handler middleware
 * Formats standard JSON errors with correlation IDs and HTTP status codes
 */
const logger = require('../utils/logger');
const env = require('../config/env');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || (err.statusCode ? err.statusCode : 500);
  const correlationId = req.id || req.headers['x-request-id'] || 'unknown';

  logger.error(
    {
      correlationId,
      status,
      message: err.message,
      stack: env.NODE_ENV !== 'production' ? err.stack : undefined,
      path: req.originalUrl,
      method: req.method,
    },
    'Request handler error'
  );

  res.status(status).json({
    error: {
      message: err.message || 'Internal Server Error',
      status,
      correlationId,
      timestamp: new Date().toISOString(),
    },
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      message: `Resource not found: ${req.method} ${req.originalUrl}`,
      status: 404,
      timestamp: new Date().toISOString(),
    },
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
