/**
 * Vercel Serverless Function entrypoint
 */
const createApp = require('../src/app');
const db = require('../src/db');
const { runMigrations } = require('../src/db/migrate');
const { seedDatabase } = require('../src/db/seed');
const logger = require('../src/utils/logger');

let initialized = false;

async function ensureDbInitialized() {
  if (initialized) return;
  try {
    if (process.env.DATABASE_URL) {
      await runMigrations();
      const countRes = await db.query('SELECT COUNT(*) as count FROM products');
      if (parseInt(countRes.rows[0].count, 10) === 0) {
        await seedDatabase();
      }
    }
    initialized = true;
  } catch (err) {
    logger.warn({ err: err.message }, 'Vercel DB auto-init skipped');
  }
}

const app = createApp();

module.exports = async (req, res) => {
  await ensureDbInitialized();
  return app(req, res);
};
