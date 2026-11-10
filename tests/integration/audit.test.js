const request = require('supertest');
const createApp = require('../../src/app');
const env = require('../../src/config/env');
const { setupTestDb, teardownTestDb } = require('../setup');

describe('Audit Logging Verification', () => {
  let app;

  beforeAll(async () => {
    await setupTestDb();
    app = createApp();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  test('audit events are recorded on admin stock updates and can be retrieved', async () => {
    // 1. Perform admin stock update
    const updateRes = await request(app)
      .put('/api/admin/products/5/stock')
      .set('X-Admin-Token', env.ADMIN_API_KEY)
      .set('X-Admin-Actor', 'sre-engineer-jane')
      .send({ stock: 77, reason: 'Warehouse cycle count reconciliation' });

    expect(updateRes.status).toBe(200);

    // 2. Fetch audit logs via protected endpoint
    const auditRes = await request(app)
      .get('/api/admin/audit-logs?entityType=PRODUCT_STOCK&entityId=5')
      .set('X-Admin-Token', env.ADMIN_API_KEY);

    expect(auditRes.status).toBe(200);
    expect(auditRes.body).toHaveProperty('auditLogs');
    expect(Array.isArray(auditRes.body.auditLogs)).toBe(true);
    expect(auditRes.body.auditLogs.length).toBeGreaterThan(0);

    const log = auditRes.body.auditLogs[0];
    expect(log.action).toBe('STOCK_UPDATE');
    expect(log.actor).toBe('sre-engineer-jane');
    expect(log.reason).toBe('Warehouse cycle count reconciliation');
    expect(log.new_values.stock).toBe(77);
  });
});
