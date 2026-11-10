/**
 * Test setup and database fixture configuration
 * Automatically provisions an in-memory or real PostgreSQL instance
 */
const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');
const db = require('../src/db');

let memDb = null;

async function setupTestDb() {
  if (process.env.USE_REAL_DB === 'true') {
    // When running in CI with real Postgres container
    const { runMigrations } = require('../src/db/migrate');
    const { seedDatabase } = require('../src/db/seed');
    await runMigrations();
    await seedDatabase();
    return db.getPool();
  }

  // Standalone in-memory PostgreSQL emulator using pg-mem
  memDb = newDb();

  // Register uuid extension simulation
  memDb.public.registerFunction({
    name: 'gen_random_uuid',
    implementation: () => require('crypto').randomUUID(),
  });

  const schemaPath = path.join(__dirname, '../src/db/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Clean Postgres-specific statements if needed for pg-mem
  const cleanedSchema = schemaSql
    .replace(/CREATE INDEX IF NOT EXISTS[^\n;]+;/g, '') // pg-mem has custom index handling
    .replace(/TIMESTAMPTZ/g, 'TIMESTAMP');

  memDb.public.none(cleanedSchema);

  const seedPath = path.join(__dirname, '../src/db/seed.sql');
  const seedSql = fs.readFileSync(seedPath, 'utf8')
    .replace(/ON CONFLICT \(sku\) DO NOTHING;/g, ';');

  memDb.public.none(seedSql);

  const pgAdapter = memDb.adapters.createPg();
  const pool = new pgAdapter.Pool();

  db.setPool(pool);
  return pool;
}

async function teardownTestDb() {
  await db.closePool();
}

module.exports = {
  setupTestDb,
  teardownTestDb,
};
