/**
 * Order processing routes
 * Enforces idempotency, atomic inventory deduction, and provides order status lookup
 */
const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');

// Create order (Idempotent)
router.post('/orders', async (req, res, next) => {
  try {
    const idempotencyKey =
      req.headers['idempotency-key'] ||
      req.headers['x-idempotency-key'] ||
      req.body.idempotencyKey;

    if (!idempotencyKey) {
      return res.status(400).json({
        error: {
          code: 'MISSING_IDEMPOTENCY_KEY',
          message: 'An Idempotency-Key header is required for safe checkout',
        },
      });
    }

    const { customerName, customerEmail, items } = req.body;

    const result = await orderService.createOrder({
      idempotencyKey,
      customerName,
      customerEmail,
      items,
    });

    if (result.isIdempotentReplay) {
      res.setHeader('X-Idempotent-Replay', 'true');
      return res.status(200).json({
        message: 'Order already processed (idempotent replay)',
        order: result.order,
      });
    }

    res.setHeader('X-Idempotent-Replay', 'false');
    res.status(201).json({
      message: 'Order successfully created',
      order: result.order,
    });
  } catch (err) {
    next(err);
  }
});

// Simple order status endpoint
router.get('/orders/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await orderService.getOrderById(id);

    if (!order) {
      return res.status(404).json({
        error: {
          code: 'ORDER_NOT_FOUND',
          message: `Order with ID ${id} not found`,
        },
      });
    }

    res.json({
      orderId: order.id,
      status: order.status,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      totalAmount: order.total_amount,
      createdAt: order.created_at,
      items: order.items,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
