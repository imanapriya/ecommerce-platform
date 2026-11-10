/**
 * Database seed runner script
 */
const fs = require('fs');
const path = require('path');
const db = require('./index');
const logger = require('../utils/logger');

async function seedDatabase() {
  logger.info('Starting database seeding...');
  const seedPath = path.join(__dirname, 'seed.sql');
  const sql = fs.readFileSync(seedPath, 'utf8');

  try {
    await db.query(sql);
    const countRes = await db.query('SELECT COUNT(*) as count FROM products');
    logger.info({ totalProducts: countRes.rows[0].count }, 'Database seeding completed successfully');
  } catch (err) {
    logger.error({ err: err.message }, 'Database seeding failed');
    throw err;
  }
}

if (require.main === module) {
  seedDatabase()
    .then(() => db.closePool())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
