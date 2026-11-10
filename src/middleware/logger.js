/**
 * HTTP Request correlation and structured logging middleware
 */
const { v4: uuidv4 } = require('uuid');
const pinoHttp = require('pino-http');
const logger = require('../utils/logger');

const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || uuidv4(),
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} completed with status ${res.statusCode}`,
  customErrorMessage: (req, res, err) => `${req.method} ${req.url} failed: ${err.message}`,
  autoLogging: {
    ignore: (req) => req.url === '/healthz' || req.url === '/ready' || req.url === '/metrics',
  },
});

function requestCorrelation(req, res, next) {
  const reqId = req.headers['x-request-id'] || uuidv4();
  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);
  httpLogger(req, res, next);
}

module.exports = { requestCorrelation };
