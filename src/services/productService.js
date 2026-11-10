/**
 * Product catalog service
 * Handles querying, search, product creation, and stock updates with audit logging
 */
const db = require('../db');
const auditService = require('./auditService');
const { inventoryAdjustmentsTotal } = require('../utils/metrics');

async function listProducts({ search, category, limit = 20, offset = 0, activeOnly = true } = {}) {
  let sql = 'SELECT id, sku, name, description, category, price, stock, is_active, created_at, updated_at FROM products WHERE 1=1';
  const params = [];

  if (activeOnly) {
    params.push(true);
    sql += ` AND is_active = $${params.length}`;
  }

  if (category) {
    params.push(category);
    sql += ` AND category = $${params.length}`;
  }

  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length} OR sku ILIKE $${params.length})`;
  }

  // Count total matching items
  const countSql = sql.replace('SELECT id, sku, name, description, category, price, stock, is_active, created_at, updated_at', 'SELECT COUNT(*) as count');
  const countRes = await db.query(countSql, params);
  const total = parseInt(countRes.rows[0].count, 10);

  // Pagination
  params.push(Math.min(limit, 100));
  sql += ` ORDER BY id ASC LIMIT $${params.length}`;
  params.push(Math.max(offset, 0));
  sql += ` OFFSET $${params.length}`;

  const res = await db.query(sql, params);
  return {
    products: res.rows.map(p => ({ ...p, price: parseFloat(p.price) })),
    total,
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
  };
}

async function getProductById(id) {
  const sql = 'SELECT id, sku, name, description, category, price, stock, is_active, created_at, updated_at FROM products WHERE id = $1';
  const res = await db.query(sql, [id]);
  if (res.rows.length === 0) {
    return null;
  }
  const p = res.rows[0];
  return { ...p, price: parseFloat(p.price) };
}

async function updateProductStock({ productId, newStock, actor, reason, dbClient = null }) {
  if (!Number.isInteger(newStock) || newStock < 0) {
    throw new Error('Stock must be a non-negative integer');
  }

  const execute = async (client) => {
    // Lock row for update
    const existingRes = await client.query('SELECT id, sku, name, stock FROM products WHERE id = $1 FOR UPDATE', [productId]);
    if (existingRes.rows.length === 0) {
      throw new Error(`Product with ID ${productId} not found`);
    }

    const currentProduct = existingRes.rows[0];
    const oldStock = currentProduct.stock;

    // Update stock
    const updateRes = await client.query(
      'UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, sku, name, category, price, stock, is_active, updated_at',
      [newStock, productId]
    );

    const updatedProduct = updateRes.rows[0];

    // Audit log
    await auditService.recordAuditLog({
      entityType: 'PRODUCT_STOCK',
      entityId: productId,
      action: 'STOCK_UPDATE',
      actor: actor || 'admin',
      oldValues: { stock: oldStock },
      newValues: { stock: newStock },
      reason: reason || 'Manual administrative stock update',
      client,
    });

    inventoryAdjustmentsTotal.inc({ action: 'admin_update', status: 'success' });
    return { ...updatedProduct, price: parseFloat(updatedProduct.price) };
  };

  if (dbClient) {
    return await execute(dbClient);
  }
  return await db.withTransaction(execute);
}

async function createProduct({ sku, name, description, category, price, stock, actor }) {
  if (price < 0) throw new Error('Price must be greater than or equal to 0');
  if (stock < 0) throw new Error('Stock must be non-negative');

  return await db.withTransaction(async (client) => {
    const sql = `
      INSERT INTO products (sku, name, description, category, price, stock)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, sku, name, description, category, price, stock, is_active, created_at
    `;
    const res = await client.query(sql, [sku, name, description, category, price, stock]);
    const product = res.rows[0];

    await auditService.recordAuditLog({
      entityType: 'PRODUCT',
      entityId: product.id,
      action: 'PRODUCT_CREATE',
      actor: actor || 'admin',
      oldValues: null,
      newValues: product,
      reason: 'Product added to catalog',
      client,
    });

    return { ...product, price: parseFloat(product.price) };
  });
}

module.exports = {
  listProducts,
  getProductById,
  updateProductStock,
  createProduct,
};
