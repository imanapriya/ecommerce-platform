/**
 * Server entrypoint with graceful shutdown and startup lifecycle management
 */
const createApp = require('./src/app');
const env = require('./src/config/env');
const db = require('./src/db');
const { runMigrations } = require('./src/db/migrate');
const { seedDatabase } = require('./src/db/seed');
const logger = require('./src/utils/logger');

const app = createApp();
const PORT = env.PORT;

let server = null;

async function bootstrap() {
  try {
    // Run schema migrations and seed catalog if in container / auto mode
    if (process.env.AUTO_MIGRATE === 'true' || env.NODE_ENV !== 'test') {
      try {
        await runMigrations();
        const countRes = await db.query('SELECT COUNT(*) as count FROM products');
        if (parseInt(countRes.rows[0].count, 10) === 0) {
          logger.info('Products table empty; executing seed data...');
          await seedDatabase();
        }
      } catch (dbInitErr) {
        logger.warn({ err: dbInitErr.message }, 'Database auto-init skipped or waiting for DB to become available');
      }
    }

    server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(
        {
          port: PORT,
          nodeEnv: env.NODE_ENV,
          version: env.APP_VERSION,
        },
        `E-Commerce API server listening on http://0.0.0.0:${PORT}`
      );
    });

    // Graceful shutdown handling
    const shutdown = async (signal) => {
      logger.info({ signal }, 'Received termination signal, starting graceful shutdown...');

      if (server) {
        server.close(async () => {
          logger.info('HTTP server closed, completing outstanding database connections...');
          try {
            await db.closePool();
            logger.info('Database pool successfully closed');
            process.exit(0);
          } catch (err) {
            logger.error({ err }, 'Error during database pool closure');
            process.exit(1);
          }
        });

        // Force shutdown after timeout if pending connections hang
        setTimeout(() => {
          logger.error('Graceful shutdown timed out, forcing exit');
          process.exit(1);
        }, 10000).unref();
      } else {
        process.exit(0);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.fatal({ err }, 'Fatal error during server bootstrap');
    process.exit(1);
  }
}

if (require.main === module) {
  bootstrap();
}

module.exports = { app, bootstrap };
