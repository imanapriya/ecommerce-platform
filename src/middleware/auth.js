/**
 * Administrative authentication and authorization middleware
 * Protects administrative product/stock modification endpoints
 */
const env = require('../config/env');
const logger = require('../utils/logger');

function requireAdminAuth(req, res, next) {
  const token =
    req.headers['x-admin-token'] ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null);

  if (!token || token !== env.ADMIN_API_KEY) {
    logger.warn(
      {
        ip: req.ip,
        path: req.originalUrl,
        method: req.method,
      },
      'Unauthorized administrative access attempt'
    );

    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing administrative authorization token',
      },
    });
  }

  req.actor = req.headers['x-admin-actor'] || 'admin-user';
  next();
}

module.exports = { requireAdminAuth };
