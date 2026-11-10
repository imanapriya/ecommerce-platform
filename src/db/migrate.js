/**
 * Database schema migration script
 */
const fs = require('fs');
const path = require('path');
const db = require('./index');
const logger = require('../utils/logger');

async function runMigrations() {
  logger.info('Starting database migration...');
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  try {
    await db.query(sql);
    logger.info('Database schema migration completed successfully');
  } catch (err) {
    logger.error({ err: err.message }, 'Migration failed');
    throw err;
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => db.closePool())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runMigrations };
