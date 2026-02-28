const express = require('express');
const db = require('../db');

const router = express.Router();

function landedCostPerUnit(batch) {
  const { unit_price_aud, exchange_rate, shipping_aud, customs_php, quantity } = batch;
  return (unit_price_aud * exchange_rate) +
         (shipping_aud * exchange_rate / quantity) +
         (customs_php / quantity);
}

// GET /api/sales?product_id=X&from=Y&to=Z
router.get('/', (req, res) => {
  const { product_id, from, to } = req.query;
  let where = [];
  const params = [];

  if (product_id) { where.push('s.product_id = ?'); params.push(product_id); }
  if (from)       { where.push('s.sale_date >= ?'); params.push(from); }
  if (to)         { where.push('s.sale_date <= ?'); params.push(to); }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const sales = db.prepare(`
    SELECT
      s.*,
      p.name AS product_name,
      p.sku,
      s.sale_price_php * s.quantity_sold                                        AS revenue,
      COALESCE(SUM(a.units_taken * a.landed_cost_per_unit_php), 0)              AS cogs,
      (s.sale_price_php * s.quantity_sold)
        - COALESCE(SUM(a.units_taken * a.landed_cost_per_unit_php), 0)          AS gross_profit,
      (s.sale_price_php * s.quantity_sold)
        - COALESCE(SUM(a.units_taken * a.landed_cost_per_unit_php), 0)
        - s.delivery_cost_php                                                   AS net_profit
    FROM sales s
    JOIN products p ON p.id = s.product_id
    LEFT JOIN sale_batch_allocations a ON a.sale_id = s.id
    ${whereClause}
    GROUP BY s.id
    ORDER BY s.sale_date DESC, s.id DESC
  `).all(...params);

  res.json(sales);
});

// POST /api/sales — FIFO transaction
router.post('/', (req, res, next) => {
  const { product_id, sale_date, quantity_sold, sale_price_php, delivery_cost_php, notes } = req.body;

  if (!product_id || !sale_date || !quantity_sold || !sale_price_php) {
    return res.status(400).json({ error: 'product_id, sale_date, quantity_sold, sale_price_php are required' });
  }
  if (quantity_sold <= 0) return res.status(400).json({ error: 'quantity_sold must be positive' });

  const runSale = db.transaction(() => {
    // Get available batches in FIFO order
    const batches = db.prepare(`
      SELECT * FROM purchase_batches
      WHERE product_id = ? AND remaining_qty > 0
      ORDER BY purchase_date ASC, id ASC
    `).all(product_id);

    const totalAvailable = batches.reduce((sum, b) => sum + b.remaining_qty, 0);
    if (totalAvailable < quantity_sold) {
      const err = new Error(`Insufficient stock. Available: ${totalAvailable}, Requested: ${quantity_sold}`);
      err.status = 409;
      throw err;
    }

    // Insert sale
    const saleResult = db.prepare(`
      INSERT INTO sales (product_id, sale_date, quantity_sold, sale_price_php, delivery_cost_php, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(product_id, sale_date, quantity_sold, sale_price_php, delivery_cost_php || 0, notes || null);

    const saleId = saleResult.lastInsertRowid;

    // Walk FIFO batches
    let remaining = quantity_sold;
    const allocations = [];

    for (const batch of batches) {
      if (remaining <= 0) break;

      const taken = Math.min(remaining, batch.remaining_qty);
      const costPerUnit = landedCostPerUnit(batch);

      db.prepare(`
        UPDATE purchase_batches SET remaining_qty = remaining_qty - ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(taken, batch.id);

      db.prepare(`
        INSERT INTO sale_batch_allocations (sale_id, batch_id, units_taken, landed_cost_per_unit_php)
        VALUES (?, ?, ?, ?)
      `).run(saleId, batch.id, taken, costPerUnit);

      allocations.push({ batch_id: batch.id, units_taken: taken, landed_cost_per_unit_php: costPerUnit });
      remaining -= taken;
    }

    return saleId;
  });

  try {
    const saleId = runSale();

    const sale = db.prepare(`
      SELECT
        s.*,
        p.name AS product_name,
        p.sku,
        s.sale_price_php * s.quantity_sold                                        AS revenue,
        COALESCE(SUM(a.units_taken * a.landed_cost_per_unit_php), 0)              AS cogs,
        (s.sale_price_php * s.quantity_sold)
          - COALESCE(SUM(a.units_taken * a.landed_cost_per_unit_php), 0)          AS gross_profit,
        (s.sale_price_php * s.quantity_sold)
          - COALESCE(SUM(a.units_taken * a.landed_cost_per_unit_php), 0)
          - s.delivery_cost_php                                                   AS net_profit
      FROM sales s
      JOIN products p ON p.id = s.product_id
      LEFT JOIN sale_batch_allocations a ON a.sale_id = s.id
      WHERE s.id = ?
      GROUP BY s.id
    `).get(saleId);

    res.status(201).json(sale);
  } catch (err) {
    next(err);
  }
});

// PUT /api/sales/:id — edit sale (reverses old FIFO allocations, re-runs with new values)
router.put('/:id', (req, res, next) => {
  const { product_id, sale_date, quantity_sold, sale_price_php, delivery_cost_php, notes } = req.body;

  if (!product_id || !sale_date || !quantity_sold || !sale_price_php) {
    return res.status(400).json({ error: 'product_id, sale_date, quantity_sold, sale_price_php are required' });
  }
  if (quantity_sold <= 0) return res.status(400).json({ error: 'quantity_sold must be positive' });

  const editSale = db.transaction(() => {
    const exists = db.prepare('SELECT id FROM sales WHERE id = ?').get(req.params.id);
    if (!exists) { const e = new Error('Sale not found'); e.status = 404; throw e; }

    // 1. Reverse existing FIFO allocations — restore stock to batches
    const oldAllocs = db.prepare('SELECT * FROM sale_batch_allocations WHERE sale_id = ?').all(req.params.id);
    for (const alloc of oldAllocs) {
      db.prepare(`
        UPDATE purchase_batches SET remaining_qty = remaining_qty + ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(alloc.units_taken, alloc.batch_id);
    }
    db.prepare('DELETE FROM sale_batch_allocations WHERE sale_id = ?').run(req.params.id);

    // 2. Check new stock availability (FIFO order)
    const batches = db.prepare(`
      SELECT * FROM purchase_batches
      WHERE product_id = ? AND remaining_qty > 0
      ORDER BY purchase_date ASC, id ASC
    `).all(product_id);

    const totalAvailable = batches.reduce((sum, b) => sum + b.remaining_qty, 0);
    if (totalAvailable < quantity_sold) {
      const err = new Error(`Insufficient stock. Available: ${totalAvailable}, Requested: ${quantity_sold}`);
      err.status = 409;
      throw err;
    }

    // 3. Update the sale record
    db.prepare(`
      UPDATE sales
      SET product_id = ?, sale_date = ?, quantity_sold = ?, sale_price_php = ?,
          delivery_cost_php = ?, notes = ?
      WHERE id = ?
    `).run(product_id, sale_date, quantity_sold, sale_price_php, delivery_cost_php || 0, notes || null, req.params.id);

    // 4. Re-run FIFO allocations with new values
    let remaining = quantity_sold;
    for (const batch of batches) {
      if (remaining <= 0) break;
      const taken = Math.min(remaining, batch.remaining_qty);
      const costPerUnit = landedCostPerUnit(batch);
      db.prepare(`
        UPDATE purchase_batches SET remaining_qty = remaining_qty - ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(taken, batch.id);
      db.prepare(`
        INSERT INTO sale_batch_allocations (sale_id, batch_id, units_taken, landed_cost_per_unit_php)
        VALUES (?, ?, ?, ?)
      `).run(req.params.id, batch.id, taken, costPerUnit);
      remaining -= taken;
    }
  });

  try {
    editSale();
    const sale = db.prepare(`
      SELECT s.*, p.name AS product_name, p.sku,
        s.sale_price_php * s.quantity_sold AS revenue,
        COALESCE(SUM(a.units_taken * a.landed_cost_per_unit_php), 0) AS cogs,
        (s.sale_price_php * s.quantity_sold) - COALESCE(SUM(a.units_taken * a.landed_cost_per_unit_php), 0) AS gross_profit,
        (s.sale_price_php * s.quantity_sold) - COALESCE(SUM(a.units_taken * a.landed_cost_per_unit_php), 0) - s.delivery_cost_php AS net_profit
      FROM sales s
      JOIN products p ON p.id = s.product_id
      LEFT JOIN sale_batch_allocations a ON a.sale_id = s.id
      WHERE s.id = ? GROUP BY s.id
    `).get(req.params.id);
    res.json(sale);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/sales/:id — void sale, restore stock
router.delete('/:id', (req, res, next) => {
  const voidSale = db.transaction(() => {
    const allocations = db.prepare(`
      SELECT * FROM sale_batch_allocations WHERE sale_id = ?
    `).all(req.params.id);

    if (allocations.length === 0) {
      const exists = db.prepare('SELECT id FROM sales WHERE id = ?').get(req.params.id);
      if (!exists) {
        const err = new Error('Sale not found');
        err.status = 404;
        throw err;
      }
    }

    // Restore remaining_qty for each batch
    for (const alloc of allocations) {
      db.prepare(`
        UPDATE purchase_batches SET remaining_qty = remaining_qty + ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(alloc.units_taken, alloc.batch_id);
    }

    // ON DELETE CASCADE removes allocations automatically
    db.prepare('DELETE FROM sales WHERE id = ?').run(req.params.id);
  });

  try {
    voidSale();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
