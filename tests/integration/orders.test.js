const request = require('supertest');
const createApp = require('../../src/app');
const { setupTestDb, teardownTestDb } = require('../setup');

describe('Order Creation & Processing API', () => {
  let app;

  beforeAll(async () => {
    await setupTestDb();
    app = createApp();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('Validation & Edge Cases', () => {
    test('rejects order without Idempotency-Key header (400)', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({
          customerName: 'Alice Developer',
          customerEmail: 'alice@algions.com',
          items: [{ productId: 2, quantity: 1 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_IDEMPOTENCY_KEY');
    });

    test('rejects order with empty items array (400)', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Idempotency-Key', 'order-val-test-01')
        .send({
          customerName: 'Alice Developer',
          customerEmail: 'alice@algions.com',
          items: [],
        });

      expect(res.status).toBe(400);
    });

    test('rejects order for non-existent product ID (404)', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Idempotency-Key', 'order-val-test-02')
        .send({
          customerName: 'Alice Developer',
          customerEmail: 'alice@algions.com',
          items: [{ productId: 999999, quantity: 1 }],
        });

      expect(res.status).toBe(404);
    });

    test('rejects order with zero or negative quantity (400)', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Idempotency-Key', 'order-val-test-03')
        .send({
          customerName: 'Alice Developer',
          customerEmail: 'alice@algions.com',
          items: [{ productId: 2, quantity: 0 }],
        });

      expect(res.status).toBe(400);
    });
  });

  describe('Negative Stock Prevention & Stock Snapshot', () => {
    test('prevents order if requested quantity exceeds available stock (negative stock prevention)', async () => {
      // Product 2 has 15 items in seed
      const prodRes = await request(app).get('/api/products/2');
      const initialStock = prodRes.body.stock;

      const res = await request(app)
        .post('/api/orders')
        .set('Idempotency-Key', 'order-neg-stock-test-01')
        .send({
          customerName: 'Bob Builder',
          customerEmail: 'bob@algions.com',
          items: [{ productId: 2, quantity: initialStock + 10 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Insufficient stock');

      // Verify stock was NOT deducted
      const verifyRes = await request(app).get('/api/products/2');
      expect(verifyRes.body.stock).toBe(initialStock);
    });

    test('successfully processes valid order and captures snapshot prices', async () => {
      const prodRes = await request(app).get('/api/products/3');
      const initialStock = prodRes.body.stock;
      const initialPrice = prodRes.body.price;

      const res = await request(app)
        .post('/api/orders')
        .set('Idempotency-Key', 'order-success-test-01')
        .send({
          customerName: 'Charlie Engineer',
          customerEmail: 'charlie@algions.com',
          items: [{ productId: 3, quantity: 2 }],
        });

      expect(res.status).toBe(201);
      expect(res.headers['x-idempotent-replay']).toBe('false');
      expect(res.body.order).toHaveProperty('id');
      expect(res.body.order.status).toBe('COMPLETED');
      expect(res.body.order.items.length).toBe(1);
      expect(res.body.order.items[0].unit_price).toBe(initialPrice);
      expect(res.body.order.items[0].quantity).toBe(2);
      expect(res.body.order.total_amount).toBe(parseFloat((initialPrice * 2).toFixed(2)));

      // Verify stock was deducted exactly by requested quantity
      const verifyRes = await request(app).get('/api/products/3');
      expect(verifyRes.body.stock).toBe(initialStock - 2);

      // Verify order status endpoint GET /api/orders/:id
      const statusRes = await request(app).get(`/api/orders/${res.body.order.id}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.orderId).toBe(res.body.order.id);
      expect(statusRes.body.status).toBe('COMPLETED');
      expect(statusRes.body.items[0].product_name).toBe(res.body.order.items[0].product_name);
    });
  });
});
