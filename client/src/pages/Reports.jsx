import { useState, useEffect, useCallback } from 'react';
import api from '../api/client.js';
import DataTable from '../components/DataTable.jsx';
import StatCard from '../components/StatCard.jsx';

function fmt(n, dec = 2) {
  return Number(n).toLocaleString('en-PH', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function Reports() {
  const [pnl, setPnl] = useState(null);
  const [byProduct, setByProduct] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to)   params.set('to', to);
    const qs = params.toString() ? `?${params}` : '';

    Promise.all([
      api.get(`/reports/pnl${qs}`),
      api.get(`/reports/by-product${qs}`),
    ])
      .then(([p, bp]) => {
        setPnl(p.data);
        setByProduct(bp.data);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const byProductColumns = [
    { key: 'sku',          label: 'SKU',      render: r => <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{r.sku}</span> },
    { key: 'product_name', label: 'Product',  render: r => <span className="font-medium">{r.product_name}</span> },
    { key: 'units_sold',   label: 'Units Sold' },
    { key: 'revenue',      label: 'Revenue',  render: r => `₱${fmt(r.revenue)}` },
    { key: 'cogs',         label: 'COGS',     render: r => `₱${fmt(r.cogs)}` },
    { key: 'gross_profit', label: 'Gross Profit', render: r => (
        <span className={r.gross_profit >= 0 ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
          ₱{fmt(r.gross_profit)}
        </span>
      )
    },
    { key: 'delivery_costs', label: 'Delivery', render: r => `₱${fmt(r.delivery_costs)}` },
    { key: 'net_profit', label: 'Net Profit', render: r => (
        <span className={r.net_profit >= 0 ? 'text-green-700 font-bold' : 'text-red-600 font-bold'}>
          ₱{fmt(r.net_profit)}
        </span>
      )
    },
    { key: 'gross_margin_pct', label: 'Gross Margin', render: r => `${r.gross_margin_pct.toFixed(1)}%` },
    { key: 'net_margin_pct',   label: 'Net Margin',   render: r => (
        <span className={r.net_margin_pct >= 0 ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>
          {r.net_margin_pct.toFixed(1)}%
        </span>
      )
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Profit & Loss summary and per-product margin breakdown</p>
      </div>

      {/* Date range filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600 font-medium">Date range:</span>
        <input type="date" className="input w-40" value={from} onChange={e => setFrom(e.target.value)} />
        <span className="text-gray-400 text-sm">to</span>
        <input type="date" className="input w-40" value={to} onChange={e => setTo(e.target.value)} />
        {(from || to) && (
          <button className="btn-secondary text-xs" onClick={() => { setFrom(''); setTo(''); }}>
            Clear
          </button>
        )}
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : pnl && (
        <>
          {/* P&L Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Revenue"
              value={`₱${fmt(pnl.total_revenue)}`}
              sub={`${pnl.total_units_sold} units sold`}
              color="blue"
              icon="💰"
            />
            <StatCard
              label="Total COGS"
              value={`₱${fmt(pnl.total_cogs)}`}
              sub="Cost of goods sold"
              color="yellow"
              icon="🏷️"
            />
            <StatCard
              label="Gross Profit"
              value={`₱${fmt(pnl.gross_profit)}`}
              sub={`${pnl.gross_margin_pct.toFixed(1)}% margin`}
              color={pnl.gross_profit >= 0 ? 'green' : 'red'}
              icon="📊"
            />
            <StatCard
              label="Net Profit"
              value={`₱${fmt(pnl.net_profit)}`}
              sub={`${pnl.net_margin_pct.toFixed(1)}% margin`}
              color={pnl.net_profit >= 0 ? 'green' : 'red'}
              icon="🎯"
            />
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card text-center py-3">
              <p className="text-xs text-gray-500 font-semibold uppercase">Total Sales</p>
              <p className="text-xl font-bold text-gray-900">{pnl.total_sales}</p>
            </div>
            <div className="card text-center py-3">
              <p className="text-xs text-gray-500 font-semibold uppercase">Delivery Costs</p>
              <p className="text-xl font-bold text-gray-900">₱{fmt(pnl.total_delivery_costs)}</p>
            </div>
            <div className="card text-center py-3">
              <p className="text-xs text-gray-500 font-semibold uppercase">Avg Revenue / Sale</p>
              <p className="text-xl font-bold text-gray-900">
                {pnl.total_sales > 0 ? `₱${fmt(pnl.total_revenue / pnl.total_sales)}` : '—'}
              </p>
            </div>
          </div>

          {/* Per-product breakdown */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">By Product</h2>
            <DataTable
              columns={byProductColumns}
              rows={byProduct}
              emptyMessage="No sales data for this period."
            />
          </div>
        </>
      )}
    </div>
  );
}
