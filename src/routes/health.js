/**
 * Health and readiness endpoints for container orchestrators (Kubernetes / Docker)
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const env = require('../config/env');

// Liveness probe - returns 200 as long as application process is running
router.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'ecommerce-api',
    version: env.APP_VERSION,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Alias for liveness probe
router.get('/live', (req, res) => {
  res.redirect(301, '/healthz');
});

// Readiness probe - verifies database connectivity and critical dependencies
router.get('/ready', async (req, res) => {
  const dbHealth = await db.checkHealth();

  const isReady = dbHealth.ready;
  const statusCode = isReady ? 200 : 503;

  res.status(statusCode).json({
    status: isReady ? 'ready' : 'unhealthy',
    ready: isReady,
    service: 'ecommerce-api',
    version: env.APP_VERSION,
    timestamp: new Date().toISOString(),
    checks: {
      database: dbHealth,
    },
  });
});

module.exports = router;
