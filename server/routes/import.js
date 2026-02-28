const express = require('express');
const db = require('../db');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// POST /api/import
router.post('/', requireAdmin, (req, res) => {
  const { rows, purchase_date, sale_date } = req.body;

  if (!rows?.length) return res.status(400).json({ error: 'No rows to import' });
  if (!purchase_date)  return res.status(400).json({ error: 'Purchase date is required' });

  const hasSales = rows.some(r => r.sold_quantity > 0);
  if (hasSales && !sale_date) return res.status(400).json({ error: 'Sale date is required when any rows have sold quantities' });

  const run = db.transaction(() => {
    const counts = { products: 0, batches: 0, sales: 0, skipped_products: 0 };

    for (const row of rows) {
      if (!row.name?.trim()) continue;

      // Find existing product by SKU or name, or create a new one
      let product = db.prepare('SELECT id FROM products WHERE sku = ?').get(row.sku)
                 || db.prepare('SELECT id FROM products WHERE name = ?').get(row.name.trim());

      if (!product) {
        const result = db.prepare(
          "INSERT INTO products (sku, name, category, unit) VALUES (?, ?, ?, 'piece')"
        ).run(row.sku, row.name.trim(), row.category?.trim() || null);
        product = { id: result.lastInsertRowid };
        counts.products++;
      } else {
        counts.skipped_products++;
      }

      // Create purchase batch
      // remaining_qty comes directly from the sheet (already accounts for any sales)
      const batchResult = db.prepare(`
        INSERT INTO purchase_batches
          (product_id, purchase_date, quantity, remaining_qty, unit_price_aud, exchange_rate, shipping_aud, customs_php)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `).run(
        product.id,
        purchase_date,
        row.quantity,
        row.remaining_qty,
        row.unit_price_aud,
        row.exchange_rate,
        row.shipping_aud || 0
      );
      counts.batches++;

      // Create historical sale + FIFO allocation if sold_quantity > 0
      if (row.sold_quantity > 0 && row.selling_price_php > 0) {
        const qty = row.quantity || 1;
        const landed = (row.unit_price_aud * row.exchange_rate)
          + ((row.shipping_aud || 0) * row.exchange_rate / qty);

        const saleResult = db.prepare(`
          INSERT INTO sales (product_id, sale_date, quantity_sold, sale_price_php, delivery_cost_php, notes)
          VALUES (?, ?, ?, ?, 0, 'Imported from Google Sheets')
        `).run(product.id, sale_date, row.sold_quantity, row.selling_price_php);

        db.prepare(`
          INSERT INTO sale_batch_allocations (sale_id, batch_id, units_taken, landed_cost_per_unit_php)
          VALUES (?, ?, ?, ?)
        `).run(saleResult.lastInsertRowid, batchResult.lastInsertRowid, row.sold_quantity, landed);

        counts.sales++;
      }
    }

    return counts;
  });

  try {
    const counts = run();
    res.json({ success: true, ...counts });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
