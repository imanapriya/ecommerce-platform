const request = require('supertest');
const createApp = require('../../src/app');
const { setupTestDb, teardownTestDb } = require('../setup');

describe('Health and Readiness Probes', () => {
  let app;

  beforeAll(async () => {
    await setupTestDb();
    app = createApp();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  test('GET /healthz returns 200 OK and service metadata', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('ecommerce-api');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('uptimeSeconds');
  });

  test('GET /ready returns 200 and healthy database status', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.ready).toBe(true);
    expect(res.body.checks.database.status).toBe('healthy');
  });

  test('GET /metrics returns Prometheus metric format', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('ecommerce_');
  });
});
