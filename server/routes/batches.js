const express = require('express');
const db = require('../db');

const router = express.Router();

function landedCostPerUnit(batch) {
  const { unit_price_aud, exchange_rate, shipping_aud, customs_php, quantity } = batch;
  return (unit_price_aud * exchange_rate) +
         (shipping_aud * exchange_rate / quantity) +
         (customs_php / quantity);
}

// GET /api/batches?product_id=X
router.get('/', (req, res) => {
  const { product_id } = req.query;
  let query = `
    SELECT pb.*, p.name AS product_name, p.sku
    FROM purchase_batches pb
    JOIN products p ON p.id = pb.product_id
  `;
  const params = [];
  if (product_id) {
    query += ' WHERE pb.product_id = ?';
    params.push(product_id);
  }
  query += ' ORDER BY pb.purchase_date DESC, pb.id DESC';

  const batches = db.prepare(query).all(...params);
  const result = batches.map(b => ({
    ...b,
    landed_cost_per_unit_php: landedCostPerUnit(b),
    total_landed_cost_php: landedCostPerUnit(b) * b.quantity,
  }));
  res.json(result);
});

// POST /api/batches
router.post('/', (req, res, next) => {
  const { product_id, purchase_date, quantity, unit_price_aud, exchange_rate, shipping_aud, customs_php, notes } = req.body;

  if (!product_id || !purchase_date || !quantity || !unit_price_aud || !exchange_rate) {
    return res.status(400).json({ error: 'product_id, purchase_date, quantity, unit_price_aud, exchange_rate are required' });
  }
  if (quantity <= 0) return res.status(400).json({ error: 'quantity must be positive' });

  try {
    const result = db.prepare(`
      INSERT INTO purchase_batches
        (product_id, purchase_date, quantity, remaining_qty, unit_price_aud, exchange_rate, shipping_aud, customs_php, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      product_id, purchase_date, quantity, quantity,
      unit_price_aud, exchange_rate,
      shipping_aud || 0, customs_php || 0,
      notes || null
    );

    const batch = db.prepare(`
      SELECT pb.*, p.name AS product_name, p.sku
      FROM purchase_batches pb
      JOIN products p ON p.id = pb.product_id
      WHERE pb.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({
      ...batch,
      landed_cost_per_unit_php: landedCostPerUnit(batch),
      total_landed_cost_php: landedCostPerUnit(batch) * batch.quantity,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/batches/:id — only if no sales against it
router.put('/:id', (req, res, next) => {
  const { product_id, purchase_date, quantity, unit_price_aud, exchange_rate, shipping_aud, customs_php, notes } = req.body;

  const hasAllocations = db.prepare(`
    SELECT COUNT(*) AS cnt FROM sale_batch_allocations WHERE batch_id = ?
  `).get(req.params.id);

  if (hasAllocations.cnt > 0) {
    return res.status(409).json({ error: 'Cannot edit a batch that has recorded sales' });
  }

  try {
    const result = db.prepare(`
      UPDATE purchase_batches
      SET product_id = ?, purchase_date = ?, quantity = ?, remaining_qty = ?,
          unit_price_aud = ?, exchange_rate = ?, shipping_aud = ?, customs_php = ?, notes = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      product_id, purchase_date, quantity, quantity,
      unit_price_aud, exchange_rate,
      shipping_aud || 0, customs_php || 0,
      notes || null,
      req.params.id
    );

    if (result.changes === 0) return res.status(404).json({ error: 'Batch not found' });

    const batch = db.prepare(`
      SELECT pb.*, p.name AS product_name, p.sku
      FROM purchase_batches pb
      JOIN products p ON p.id = pb.product_id
      WHERE pb.id = ?
    `).get(req.params.id);

    res.json({
      ...batch,
      landed_cost_per_unit_php: landedCostPerUnit(batch),
      total_landed_cost_php: landedCostPerUnit(batch) * batch.quantity,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/batches/:id — only if no allocations
router.delete('/:id', (req, res, next) => {
  const hasAllocations = db.prepare(`
    SELECT COUNT(*) AS cnt FROM sale_batch_allocations WHERE batch_id = ?
  `).get(req.params.id);

  if (hasAllocations.cnt > 0) {
    return res.status(409).json({ error: 'Cannot delete a batch with recorded sales' });
  }

  try {
    const result = db.prepare('DELETE FROM purchase_batches WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Batch not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
