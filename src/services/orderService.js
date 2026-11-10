/**
 * Order processing service
 * Implements atomic inventory deduction, price/stock snapshots,
 * and robust idempotency to prevent double-charging or duplicate deductions.
 */
const db = require('../db');
const auditService = require('./auditService');
const { ordersCreatedTotal, inventoryAdjustmentsTotal } = require('../utils/metrics');
const logger = require('../utils/logger');

async function getOrderById(orderId) {
  const orderRes = await db.query(
    'SELECT id, idempotency_key, customer_name, customer_email, total_amount, status, created_at FROM orders WHERE id = $1',
    [orderId]
  );
  if (orderRes.rows.length === 0) {
    return null;
  }

  const order = orderRes.rows[0];
  const itemsRes = await db.query(
    'SELECT id, product_id, product_name, sku, quantity, unit_price, total_price, created_at FROM order_items WHERE order_id = $1 ORDER BY id ASC',
    [orderId]
  );

  return {
    ...order,
    total_amount: parseFloat(order.total_amount),
    items: itemsRes.rows.map((item) => ({
      ...item,
      unit_price: parseFloat(item.unit_price),
      total_price: parseFloat(item.total_price),
    })),
  };
}

async function getOrderByOrderAndItemsByField(field, value, client = null) {
  const queryExecutor = client || db;
  const orderRes = await queryExecutor.query(
    `SELECT id, idempotency_key, customer_name, customer_email, total_amount, status, created_at FROM orders WHERE ${field} = $1`,
    [value]
  );
  if (orderRes.rows.length === 0) {
    return null;
  }

  const order = orderRes.rows[0];
  const itemsRes = await queryExecutor.query(
    'SELECT id, product_id, product_name, sku, quantity, unit_price, total_price, created_at FROM order_items WHERE order_id = $1 ORDER BY id ASC',
    [order.id]
  );

  return {
    ...order,
    total_amount: parseFloat(order.total_amount),
    items: itemsRes.rows.map((item) => ({
      ...item,
      unit_price: parseFloat(item.unit_price),
      total_price: parseFloat(item.total_price),
    })),
  };
}

async function createOrder({ idempotencyKey, customerName, customerEmail, items }) {
  if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
    const err = new Error('Idempotency-Key header or property is required for order creation');
    err.status = 400;
    throw err;
  }

  if (!customerName || !customerEmail) {
    const err = new Error('Customer name and email are required');
    err.status = 400;
    throw err;
  }

  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('Order must contain at least one item');
    err.status = 400;
    throw err;
  }

  // 1. Check if an order with this idempotency key was already created
  const existingOrder = await getOrderByOrderAndItemsByField('idempotency_key', idempotencyKey.trim());
  if (existingOrder) {
    logger.info({ idempotencyKey, orderId: existingOrder.id }, 'Returning existing order for idempotency key');
    ordersCreatedTotal.inc({ outcome: 'idempotent_duplicate' });
    return {
      isIdempotentReplay: true,
      order: existingOrder,
    };
  }

  // 2. Process order within atomic ACID transaction
  try {
    const newOrder = await db.withTransaction(async (client) => {
      let totalAmount = 0;
      const orderItemsToInsert = [];

      // Sort items by product_id to prevent database deadlocks on concurrent orders
      const sortedItems = [...items].sort((a, b) => a.productId - b.productId);

      for (const item of sortedItems) {
        const productId = parseInt(item.productId, 10);
        const quantity = parseInt(item.quantity, 10);

        if (isNaN(productId) || productId <= 0) {
          const err = new Error(`Invalid productId: ${item.productId}`);
          err.status = 400;
          throw err;
        }

        if (isNaN(quantity) || quantity <= 0) {
          const err = new Error(`Invalid quantity for product ${productId}: must be greater than 0`);
          err.status = 400;
          throw err;
        }

        // Lock row FOR UPDATE to prevent concurrent race condition stock deduction
        const productRes = await client.query(
          'SELECT id, sku, name, price, stock, is_active FROM products WHERE id = $1 FOR UPDATE',
          [productId]
        );

        if (productRes.rows.length === 0) {
          const err = new Error(`Product with ID ${productId} not found`);
          err.status = 404;
          throw err;
        }

        const product = productRes.rows[0];

        if (!product.is_active) {
          const err = new Error(`Product "${product.name}" (SKU: ${product.sku}) is currently inactive`);
          err.status = 400;
          throw err;
        }

        if (product.stock < quantity) {
          const err = new Error(
            `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${quantity}`
          );
          err.status = 400;
          throw err;
        }

        const unitPrice = parseFloat(product.price);
        const lineTotal = parseFloat((unitPrice * quantity).toFixed(2));
        totalAmount += lineTotal;
        const newStock = product.stock - quantity;

        // Deduct stock atomically (protected by row lock)
        await client.query(
          'UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [newStock, productId]
        );

        inventoryAdjustmentsTotal.inc({ action: 'order_deduct', status: 'success' });

        orderItemsToInsert.push({
          productId,
          productName: product.name,
          sku: product.sku,
          quantity,
          unitPrice,
          lineTotal,
        });
      }

      totalAmount = parseFloat(totalAmount.toFixed(2));

      // Insert master order
      const insertOrderSql = `
        INSERT INTO orders (idempotency_key, customer_name, customer_email, total_amount, status)
        VALUES ($1, $2, $3, $4, 'COMPLETED')
        RETURNING id, idempotency_key, customer_name, customer_email, total_amount, status, created_at
      `;
      const orderInsertRes = await client.query(insertOrderSql, [
        idempotencyKey.trim(),
        customerName.trim(),
        customerEmail.trim(),
        totalAmount,
      ]);
      const createdOrder = orderInsertRes.rows[0];

      // Insert order item line items with price snapshot
      const createdItems = [];
      for (const line of orderItemsToInsert) {
        const insertItemSql = `
          INSERT INTO order_items (order_id, product_id, product_name, sku, quantity, unit_price, total_price)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, product_id, product_name, sku, quantity, unit_price, total_price, created_at
        `;
        const itemRes = await client.query(insertItemSql, [
          createdOrder.id,
          line.productId,
          line.productName,
          line.sku,
          line.quantity,
          line.unitPrice,
          line.lineTotal,
        ]);
        createdItems.push({
          ...itemRes.rows[0],
          unit_price: parseFloat(itemRes.rows[0].unit_price),
          total_price: parseFloat(itemRes.rows[0].total_price),
        });
      }

      // Record audit entry for order creation
      await auditService.recordAuditLog({
        entityType: 'ORDER',
        entityId: createdOrder.id,
        action: 'ORDER_CREATED',
        actor: customerEmail.trim(),
        oldValues: null,
        newValues: { orderId: createdOrder.id, totalAmount, itemsCount: createdItems.length },
        reason: 'Customer completed checkout',
        client,
      });

      return {
        ...createdOrder,
        total_amount: parseFloat(createdOrder.total_amount),
        items: createdItems,
      };
    });

    ordersCreatedTotal.inc({ outcome: 'new' });
    logger.info({ orderId: newOrder.id, totalAmount: newOrder.total_amount }, 'Order created successfully');
    return {
      isIdempotentReplay: false,
      order: newOrder,
    };
  } catch (err) {
    // Handle unique violation gracefully if concurrent request won the race
    if (err.code === '23505' && err.detail && err.detail.includes('idempotency_key')) {
      logger.warn({ idempotencyKey }, 'Concurrent checkout with same idempotency key detected; returning existing order');
      const existing = await getOrderByOrderAndItemsByField('idempotency_key', idempotencyKey.trim());
      if (existing) {
        ordersCreatedTotal.inc({ outcome: 'idempotent_duplicate' });
        return {
          isIdempotentReplay: true,
          order: existing,
        };
      }
    }
    ordersCreatedTotal.inc({ outcome: 'failed' });
    throw err;
  }
}

module.exports = {
  createOrder,
  getOrderById,
};
