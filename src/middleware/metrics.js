/**
 * Prometheus request latency and throughput metrics middleware
 */
const { httpRequestDurationSeconds, httpRequestsTotal } = require('../utils/metrics');

function metricsMiddleware(req, res, next) {
  // Ignore Prometheus scraper endpoint itself to avoid skewed counters
  if (req.path === '/metrics') {
    return next();
  }

  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationSeconds = diff[0] + diff[1] / 1e9;

    // Normalize route to avoid high cardinality
    const route = req.baseUrl || req.route?.path || req.path;
    const statusCode = res.statusCode.toString();

    httpRequestDurationSeconds.observe(
      {
        method: req.method,
        route,
        status_code: statusCode,
      },
      durationSeconds
    );

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: statusCode,
    });
  });

  next();
}

module.exports = { metricsMiddleware };
