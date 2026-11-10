const request = require('supertest');
const createApp = require('../../src/app');
const env = require('../../src/config/env');
const { setupTestDb, teardownTestDb } = require('../setup');

describe('Product Catalog & Admin API', () => {
  let app;

  beforeAll(async () => {
    await setupTestDb();
    app = createApp();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('GET /api/products', () => {
    test('returns paginated list of active products', async () => {
      const res = await request(app).get('/api/products?limit=5');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('products');
      expect(Array.isArray(res.body.products)).toBe(true);
      expect(res.body.products.length).toBeLessThanOrEqual(5);
      expect(res.body.total).toBeGreaterThan(0);
      expect(res.body.products[0]).toHaveProperty('sku');
      expect(res.body.products[0]).toHaveProperty('price');
      expect(typeof res.body.products[0].price).toBe('number');
    });

    test('filters products by category', async () => {
      const res = await request(app).get('/api/products?category=Electronics');
      expect(res.status).toBe(200);
      expect(res.body.products.every((p) => p.category === 'Electronics')).toBe(true);
    });

    test('searches products by keyword in name', async () => {
      const res = await request(app).get('/api/products?search=Keyboard');
      expect(res.status).toBe(200);
      expect(res.body.products.length).toBeGreaterThanOrEqual(1);
      expect(res.body.products[0].name).toContain('Keyboard');
    });
  });

  describe('GET /api/products/:id', () => {
    test('returns product details for valid ID', async () => {
      const res = await request(app).get('/api/products/1');
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('stock');
    });

    test('returns 404 for non-existent product ID', async () => {
      const res = await request(app).get('/api/products/99999');
      expect(res.status).toBe(404);
      expect(res.body.error).toHaveProperty('message');
    });

    test('returns 400 for invalid non-numeric product ID', async () => {
      const res = await request(app).get('/api/products/invalid-id');
      expect(res.status).toBe(400);
    });
  });

  describe('Administrative Protection & Stock Updates', () => {
    test('rejects stock update without admin token (401)', async () => {
      const res = await request(app)
        .put('/api/admin/products/1/stock')
        .send({ stock: 50 });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    test('rejects stock update with invalid token (401)', async () => {
      const res = await request(app)
        .put('/api/admin/products/1/stock')
        .set('X-Admin-Token', 'wrong-secret')
        .send({ stock: 50 });
      expect(res.status).toBe(401);
    });

    test('allows stock update with valid admin token and records audit event', async () => {
      const res = await request(app)
        .put('/api/admin/products/1/stock')
        .set('X-Admin-Token', env.ADMIN_API_KEY)
        .set('X-Admin-Actor', 'release-engineer')
        .send({ stock: 85, reason: 'Q4 Inventory Restock' });

      expect(res.status).toBe(200);
      expect(res.body.product.stock).toBe(85);

      // Verify the updated stock is persisted
      const verifyRes = await request(app).get('/api/products/1');
      expect(verifyRes.body.stock).toBe(85);
    });

    test('rejects negative stock update (400)', async () => {
      const res = await request(app)
        .put('/api/admin/products/1/stock')
        .set('X-Admin-Token', env.ADMIN_API_KEY)
        .send({ stock: -10 });

      expect(res.status).toBe(400);
    });
  });
});
