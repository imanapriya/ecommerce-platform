/**
 * Product catalog and admin management routes
 */
const express = require('express');
const router = express.Router();
const productService = require('../services/productService');
const auditService = require('../services/auditService');
const { requireAdminAuth } = require('../middleware/auth');

// Public: List and search products
router.get('/products', async (req, res, next) => {
  try {
    const { search, category, limit, offset } = req.query;
    const result = await productService.listProducts({
      search,
      category,
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Public: Get product by ID
router.get('/products/:id', async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId)) {
      return res.status(400).json({ error: { message: 'Invalid product ID' } });
    }

    const product = await productService.getProductById(productId);
    if (!product) {
      return res.status(404).json({ error: { message: `Product with ID ${productId} not found` } });
    }

    res.json(product);
  } catch (err) {
    next(err);
  }
});

// Admin: Update product stock (Protected)
router.put('/admin/products/:id/stock', requireAdminAuth, async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id, 10);
    const { stock, reason } = req.body;

    if (isNaN(productId)) {
      return res.status(400).json({ error: { message: 'Invalid product ID' } });
    }

    if (stock === undefined || !Number.isInteger(stock) || stock < 0) {
      return res.status(400).json({ error: { message: 'A non-negative integer "stock" is required' } });
    }

    const updatedProduct = await productService.updateProductStock({
      productId,
      newStock: stock,
      actor: req.actor,
      reason: reason || 'Admin inventory adjustment',
    });

    res.json({
      message: 'Product stock updated successfully',
      product: updatedProduct,
    });
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: { message: err.message } });
    }
    next(err);
  }
});

// Admin: Create product (Protected)
router.post('/admin/products', requireAdminAuth, async (req, res, next) => {
  try {
    const { sku, name, description, category, price, stock } = req.body;

    if (!sku || !name || !category || price === undefined || stock === undefined) {
      return res.status(400).json({
        error: { message: 'Required fields: sku, name, category, price, stock' },
      });
    }

    const newProduct = await productService.createProduct({
      sku,
      name,
      description,
      category,
      price: parseFloat(price),
      stock: parseInt(stock, 10),
      actor: req.actor,
    });

    res.status(201).json({
      message: 'Product created successfully',
      product: newProduct,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: { message: 'A product with this SKU already exists' } });
    }
    next(err);
  }
});

// Admin: View audit events (Protected)
router.get('/admin/audit-logs', requireAdminAuth, async (req, res, next) => {
  try {
    const { entityType, entityId, limit } = req.query;
    const logs = await auditService.getAuditLogs({
      entityType,
      entityId,
      limit: limit ? parseInt(limit, 10) : 50,
    });
    res.json({ auditLogs: logs });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
