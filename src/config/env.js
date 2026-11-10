/**
 * Environment configuration and validation module
 */
require('dotenv').config();

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  APP_VERSION: process.env.APP_VERSION || '1.0.0',
  LOG_LEVEL: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  ADMIN_API_KEY: process.env.ADMIN_API_KEY || 'algions-admin-secret-key-2026',
  
  // Database configuration
  DATABASE_URL: process.env.DATABASE_URL,
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT, 10) || 5432,
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || 'postgres',
  DB_NAME: process.env.DB_NAME || 'ecommerce_db',
  DB_POOL_MAX: parseInt(process.env.DB_POOL_MAX, 10) || 10,
  DB_IDLE_TIMEOUT_MS: parseInt(process.env.DB_IDLE_TIMEOUT_MS, 10) || 30000,
  DB_CONNECTION_TIMEOUT_MS: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS, 10) || 5000,

  // Observability & Security
  ENABLE_METRICS: process.env.ENABLE_METRICS !== 'false',
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
};

module.exports = env;
