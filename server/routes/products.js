const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/products — list active products with stock summary
router.get('/', (req, res) => {
  const products = db.prepare(`
    SELECT
      p.*,
      COALESCE(SUM(pb.remaining_qty), 0) AS stock_on_hand,
      COALESCE(SUM(pb.quantity), 0)       AS total_purchased,
      COUNT(DISTINCT pb.id)               AS batch_count
    FROM products p
    LEFT JOIN purchase_batches pb ON pb.product_id = p.id AND pb.remaining_qty > 0
    WHERE p.is_active = 1
    GROUP BY p.id
    ORDER BY p.name
  `).all();
  res.json(products);
});

// POST /api/products — create product
router.post('/', (req, res, next) => {
  const { sku, name, category, description, unit } = req.body;
  if (!sku || !name) {
    return res.status(400).json({ error: 'sku and name are required' });
  }
  try {
    const result = db.prepare(`
      INSERT INTO products (sku, name, category, description, unit)
      VALUES (?, ?, ?, ?, ?)
    `).run(sku.trim(), name.trim(), category || null, description || null, unit || 'piece');

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(product);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'SKU already exists' });
    }
    next(err);
  }
});

// PUT /api/products/:id — update product
router.put('/:id', (req, res, next) => {
  const { sku, name, category, description, unit } = req.body;
  if (!sku || !name) {
    return res.status(400).json({ error: 'sku and name are required' });
  }
  try {
    const result = db.prepare(`
      UPDATE products
      SET sku = ?, name = ?, category = ?, description = ?, unit = ?,
          updated_at = datetime('now')
      WHERE id = ? AND is_active = 1
    `).run(sku.trim(), name.trim(), category || null, description || null, unit || 'piece', req.params.id);

    if (result.changes === 0) return res.status(404).json({ error: 'Product not found' });

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json(product);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'SKU already exists' });
    }
    next(err);
  }
});

// DELETE /api/products/:id — soft delete
router.delete('/:id', (req, res, next) => {
  try {
    const result = db.prepare(`
      UPDATE products SET is_active = 0, updated_at = datetime('now')
      WHERE id = ? AND is_active = 1
    `).run(req.params.id);

    if (result.changes === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
