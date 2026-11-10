/**
 * Express application factory
 */
const express = require('express');
const { requestCorrelation } = require('./middleware/logger');
const { metricsMiddleware } = require('./middleware/metrics');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const healthRoutes = require('./routes/health');
const metricsRoutes = require('./routes/metrics');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');

function createApp() {
  const app = express();

  // Basic security and parsing
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  // Observability middlewares
  app.use(requestCorrelation);
  app.use(metricsMiddleware);

  // Health and metrics probes (standardized top-level routes for orchestrators)
  app.use('/', healthRoutes);
  app.use('/', metricsRoutes);

  // Core domain API endpoints
  app.use('/api', productRoutes);
  app.use('/api', orderRoutes);

  // Root welcome / discovery endpoint
  app.get('/', (req, res) => {
    res.json({
      service: 'Cloud Deployment & CI/CD – E-Commerce Platform API',
      status: 'operational',
      endpoints: {
        health: '/healthz',
        readiness: '/ready',
        metrics: '/metrics',
        products: '/api/products',
        orders: '/api/orders',
      },
    });
  });

  // 404 and Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
