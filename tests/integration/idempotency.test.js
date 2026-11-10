/**
 * ACCEPTANCE TEST 1: Idempotent Checkout Verification
 * "Repeated checkout with the same idempotency key must not create duplicate orders or double-deduct inventory."
 */
const request = require('supertest');
const createApp = require('../../src/app');
const db = require('../../src/db');
const { setupTestDb, teardownTestDb } = require('../setup');

describe('Acceptance Test 1: Repeated Checkout Idempotency', () => {
  let app;

  beforeAll(async () => {
    await setupTestDb();
    app = createApp();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  test('repeated checkout with identical idempotency key does not duplicate order or double-deduct stock', async () => {
    const testKey = 'ALGIONS-IDEMPOTENCY-ACCEPTANCE-TEST-1001';
    const targetProductId = 4;
    const orderQuantity = 3;

    // 1. Check initial product stock
    const prodInitial = await request(app).get(`/api/products/${targetProductId}`);
    expect(prodInitial.status).toBe(200);
    const initialStock = prodInitial.body.stock;
    expect(initialStock).toBeGreaterThanOrEqual(orderQuantity);

    const orderPayload = {
      customerName: 'DevOps Lead Reviewer',
      customerEmail: 'devops-reviewer@algions.com',
      items: [{ productId: targetProductId, quantity: orderQuantity }],
    };

    // 2. First checkout request
    const firstResponse = await request(app)
      .post('/api/orders')
      .set('Idempotency-Key', testKey)
      .send(orderPayload);

    expect(firstResponse.status).toBe(201);
    expect(firstResponse.headers['x-idempotent-replay']).toBe('false');
    const createdOrderId = firstResponse.body.order.id;
    expect(createdOrderId).toBeDefined();

    // Verify stock dropped by exactly orderQuantity
    const prodAfterFirst = await request(app).get(`/api/products/${targetProductId}`);
    const expectedStockAfterFirst = initialStock - orderQuantity;
    expect(prodAfterFirst.body.stock).toBe(expectedStockAfterFirst);

    // 3. Second checkout request (SIMULATING NETWORK RETRY / REPEATED SUBMIT)
    const secondResponse = await request(app)
      .post('/api/orders')
      .set('Idempotency-Key', testKey)
      .send(orderPayload);

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.headers['x-idempotent-replay']).toBe('true');
    expect(secondResponse.body.order.id).toBe(createdOrderId);
    expect(secondResponse.body.message).toContain('idempotent replay');

    // CRITICAL ASSERTION: Inventory must NOT be double-deducted
    const prodAfterSecond = await request(app).get(`/api/products/${targetProductId}`);
    expect(prodAfterSecond.body.stock).toBe(expectedStockAfterFirst);

    // 4. Third checkout request
    const thirdResponse = await request(app)
      .post('/api/orders')
      .set('Idempotency-Key', testKey)
      .send(orderPayload);

    expect(thirdResponse.status).toBe(200);
    expect(thirdResponse.headers['x-idempotent-replay']).toBe('true');
    expect(thirdResponse.body.order.id).toBe(createdOrderId);

    // Stock must STILL remain exactly the same
    const prodAfterThird = await request(app).get(`/api/products/${targetProductId}`);
    expect(prodAfterThird.body.stock).toBe(expectedStockAfterFirst);

    // 5. Database Direct Verification: Exactly 1 order record must exist for this key
    const orderCountRes = await db.query(
      'SELECT COUNT(*) as count FROM orders WHERE idempotency_key = $1',
      [testKey]
    );
    expect(parseInt(orderCountRes.rows[0].count, 10)).toBe(1);
  });
});
