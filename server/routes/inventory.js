const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/inventory — all products with stock + avg landed cost
router.get('/', (req, res) => {
  const inventory = db.prepare(`
    SELECT
      p.id,
      p.sku,
      p.name,
      p.category,
      p.unit,
      COALESCE(SUM(pb.remaining_qty), 0) AS stock_on_hand,
      COALESCE(
        SUM(
          pb.remaining_qty * (
            (pb.unit_price_aud * pb.exchange_rate)
            + (pb.shipping_aud * pb.exchange_rate / pb.quantity)
            + (pb.customs_php / pb.quantity)
          )
        ) / NULLIF(SUM(pb.remaining_qty), 0),
        0
      ) AS avg_landed_cost_php,
      COALESCE(
        SUM(
          pb.remaining_qty * (
            (pb.unit_price_aud * pb.exchange_rate)
            + (pb.shipping_aud * pb.exchange_rate / pb.quantity)
            + (pb.customs_php / pb.quantity)
          )
        ),
        0
      ) AS inventory_value_php
    FROM products p
    LEFT JOIN purchase_batches pb ON pb.product_id = p.id AND pb.remaining_qty > 0
    WHERE p.is_active = 1
    GROUP BY p.id
    ORDER BY p.name
  `).all();

  res.json(inventory);
});

// GET /api/inventory/:product_id — per-batch breakdown
router.get('/:product_id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(req.params.product_id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const batches = db.prepare(`
    SELECT
      pb.*,
      (
        (pb.unit_price_aud * pb.exchange_rate)
        + (pb.shipping_aud * pb.exchange_rate / pb.quantity)
        + (pb.customs_php / pb.quantity)
      ) AS landed_cost_per_unit_php,
      pb.remaining_qty * (
        (pb.unit_price_aud * pb.exchange_rate)
        + (pb.shipping_aud * pb.exchange_rate / pb.quantity)
        + (pb.customs_php / pb.quantity)
      ) AS remaining_value_php
    FROM purchase_batches pb
    WHERE pb.product_id = ? AND pb.remaining_qty > 0
    ORDER BY pb.purchase_date ASC, pb.id ASC
  `).all(req.params.product_id);

  res.json({ product, batches });
});

module.exports = router;
