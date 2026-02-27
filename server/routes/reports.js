const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/reports/pnl?from=Y&to=Z
router.get('/pnl', (req, res) => {
  const { from, to } = req.query;
  let where = [];
  const params = [];

  if (from) { where.push('s.sale_date >= ?'); params.push(from); }
  if (to)   { where.push('s.sale_date <= ?'); params.push(to); }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const summary = db.prepare(`
    SELECT
      COUNT(DISTINCT s.id)                                                       AS total_sales,
      COALESCE(SUM(s.quantity_sold), 0)                                          AS total_units_sold,
      COALESCE(SUM(s.sale_price_php * s.quantity_sold), 0)                       AS total_revenue,
      COALESCE(SUM(a.units_taken * a.landed_cost_per_unit_php), 0)               AS total_cogs,
      COALESCE(SUM(s.sale_price_php * s.quantity_sold), 0)
        - COALESCE(SUM(a.units_taken * a.landed_cost_per_unit_php), 0)           AS gross_profit,
      COALESCE(SUM(s.delivery_cost_php), 0)                                      AS total_delivery_costs,
      COALESCE(SUM(s.sale_price_php * s.quantity_sold), 0)
        - COALESCE(SUM(a.units_taken * a.landed_cost_per_unit_php), 0)
        - COALESCE(SUM(s.delivery_cost_php), 0)                                  AS net_profit
    FROM sales s
    LEFT JOIN sale_batch_allocations a ON a.sale_id = s.id
    ${whereClause}
  `).get(...params);

  // Margin calculations
  const grossMargin = summary.total_revenue > 0
    ? (summary.gross_profit / summary.total_revenue) * 100
    : 0;
  const netMargin = summary.total_revenue > 0
    ? (summary.net_profit / summary.total_revenue) * 100
    : 0;

  res.json({ ...summary, gross_margin_pct: grossMargin, net_margin_pct: netMargin, from: from || null, to: to || null });
});

// GET /api/reports/by-product
router.get('/by-product', (req, res) => {
  const { from, to } = req.query;
  let where = [];
  const params = [];

  if (from) { where.push('s.sale_date >= ?'); params.push(from); }
  if (to)   { where.push('s.sale_date <= ?'); params.push(to); }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const rows = db.prepare(`
    SELECT
      p.id AS product_id,
      p.sku,
      p.name AS product_name,
      COUNT(DISTINCT s.id)                                                       AS sales_count,
      COALESCE(SUM(s.quantity_sold), 0)                                          AS units_sold,
      COALESCE(SUM(s.sale_price_php * s.quantity_sold), 0)                       AS revenue,
      COALESCE(SUM(a.units_taken * a.landed_cost_per_unit_php), 0)               AS cogs,
      COALESCE(SUM(s.sale_price_php * s.quantity_sold), 0)
        - COALESCE(SUM(a.units_taken * a.landed_cost_per_unit_php), 0)           AS gross_profit,
      COALESCE(SUM(s.delivery_cost_php), 0)                                      AS delivery_costs,
      COALESCE(SUM(s.sale_price_php * s.quantity_sold), 0)
        - COALESCE(SUM(a.units_taken * a.landed_cost_per_unit_php), 0)
        - COALESCE(SUM(s.delivery_cost_php), 0)                                  AS net_profit
    FROM products p
    JOIN sales s ON s.product_id = p.id
    LEFT JOIN sale_batch_allocations a ON a.sale_id = s.id
    ${whereClause}
    GROUP BY p.id
    ORDER BY net_profit DESC
  `).all(...params);

  const result = rows.map(r => ({
    ...r,
    gross_margin_pct: r.revenue > 0 ? (r.gross_profit / r.revenue) * 100 : 0,
    net_margin_pct:   r.revenue > 0 ? (r.net_profit / r.revenue) * 100 : 0,
  }));

  res.json(result);
});

module.exports = router;
