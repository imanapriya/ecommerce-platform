/**
 * Prometheus metrics registry and instrumented metrics
 */
const client = require('prom-client');
const env = require('../config/env');

const register = new client.Registry();

if (env.ENABLE_METRICS) {
  client.collectDefaultMetrics({
    register,
    prefix: 'ecommerce_',
    labels: { app: 'ecommerce-platform-api', env: env.NODE_ENV },
  });
}

const httpRequestDurationSeconds = new client.Histogram({
  name: 'ecommerce_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

const httpRequestsTotal = new client.Counter({
  name: 'ecommerce_http_requests_total',
  help: 'Total number of HTTP requests handled',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const ordersCreatedTotal = new client.Counter({
  name: 'ecommerce_orders_created_total',
  help: 'Total number of orders created or retrieved via idempotency',
  labelNames: ['outcome'], // 'new', 'idempotent_duplicate', 'failed'
  registers: [register],
});

const inventoryAdjustmentsTotal = new client.Counter({
  name: 'ecommerce_inventory_adjustments_total',
  help: 'Total number of inventory stock adjustments made',
  labelNames: ['action', 'status'], // 'admin_update', 'order_deduct'
  registers: [register],
});

module.exports = {
  register,
  httpRequestDurationSeconds,
  httpRequestsTotal,
  ordersCreatedTotal,
  inventoryAdjustmentsTotal,
};
