/**
 * Production-grade structured logger using Pino
 */
const pino = require('pino');
const env = require('../config/env');

const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: 'ecommerce-api',
    version: env.APP_VERSION,
    env: env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

module.exports = logger;
