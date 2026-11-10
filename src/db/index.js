/**
 * Database client and connection pool management
 * Supports PostgreSQL connection pooling, health checks, transaction wrappers,
 * and seamless fallback to pg-mem for zero-dependency standalone testing.
 */
const { Pool } = require('pg');
const env = require('../config/env');
const logger = require('../utils/logger');

let pool = null;

function createPostgresPool() {
  if (env.DATABASE_URL) {
    return new Pool({
      connectionString: env.DATABASE_URL,
      max: env.DB_POOL_MAX,
      idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT_MS,
    });
  }

  return new Pool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT_MS,
  });
}

function getPool() {
  if (!pool) {
    pool = createPostgresPool();
    pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected database pool error');
    });
  }
  return pool;
}

/**
 * Override pool (e.g. for testing with pg-mem or custom mock)
 */
function setPool(customPool) {
  pool = customPool;
}

/**
 * Direct query execution on pool
 */
async function query(text, params) {
  const start = Date.now();
  const currentPool = getPool();
  try {
    const res = await currentPool.query(text, params);
    const duration = Date.now() - start;
    logger.debug({ query: text, duration, rows: res.rowCount }, 'Database query executed');
    return res;
  } catch (error) {
    logger.error({ query: text, err: error.message }, 'Database query failed');
    throw error;
  }
}

/**
 * Execute a callback within an isolated ACID transaction.
 * Automatically handles BEGIN, COMMIT, and ROLLBACK.
 */
async function withTransaction(callback) {
  const currentPool = getPool();
  const client = await currentPool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.error({ err: rollbackErr }, 'Failed to rollback transaction');
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Database health check for readiness probe
 */
async function checkHealth() {
  const start = Date.now();
  try {
    await query('SELECT 1 AS ok');
    const latencyMs = Date.now() - start;
    const currentPool = getPool();

    return {
      status: 'healthy',
      ready: true,
      latencyMs,
      pool: {
        total: currentPool.totalCount ?? 1,
        idle: currentPool.idleCount ?? 1,
        waiting: currentPool.waitingCount ?? 0,
      },
    };
  } catch (err) {
    return {
      status: 'unhealthy',
      ready: false,
      error: err.message,
    };
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
}

module.exports = {
  getPool,
  setPool,
  query,
  withTransaction,
  checkHealth,
  closePool,
};
