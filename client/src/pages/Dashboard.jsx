import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import StatCard from '../components/StatCard.jsx';
import ExchangeRateDisplay from '../components/ExchangeRateDisplay.jsx';
import Badge from '../components/Badge.jsx';

function fmt(n, dec = 2) {
  return Number(n).toLocaleString('en-PH', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function Dashboard() {
  const [pnl, setPnl] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/reports/pnl'),
      api.get('/inventory'),
      api.get('/sales'),
    ])
      .then(([p, inv, s]) => {
        setPnl(p.data);
        setInventory(inv.data);
        setRecentSales(s.data.slice(0, 5));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const lowStock = inventory.filter(i => i.stock_on_hand > 0 && i.stock_on_hand < 5);
  const outOfStock = inventory.filter(i => i.stock_on_hand === 0);
  const totalInventoryValue = inventory.reduce((s, i) => s + i.inventory_value_php, 0);

  if (loading) return <div className="text-center py-20 text-gray-400 text-lg">Loading dashboard...</div>;
  if (error)   return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of your resell business</p>
        </div>
        <ExchangeRateDisplay />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue"
          value={`₱${fmt(pnl?.total_revenue ?? 0)}`}
          sub="All time"
          color="blue"
          icon="💰"
        />
        <StatCard
          label="Net Profit"
          value={`₱${fmt(pnl?.net_profit ?? 0)}`}
          sub={pnl?.net_margin_pct != null ? `${pnl.net_margin_pct.toFixed(1)}% margin` : ''}
          color={pnl?.net_profit >= 0 ? 'green' : 'red'}
          icon="🎯"
        />
        <StatCard
          label="Inventory Value"
          value={`₱${fmt(totalInventoryValue)}`}
          sub={`${inventory.length} products`}
          color="purple"
          icon="🗃️"
        />
        <StatCard
          label="Total Sales"
          value={pnl?.total_sales ?? 0}
          sub={`${pnl?.total_units_sold ?? 0} units`}
          color="yellow"
          icon="📦"
        />
      </div>

      {/* Alerts */}
      {(lowStock.length > 0 || outOfStock.length > 0) && (
        <div className="card border-yellow-200 bg-yellow-50">
          <h3 className="font-semibold text-yellow-800 mb-3">Stock Alerts</h3>
          <div className="space-y-2">
            {outOfStock.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{p.name} <span className="font-mono text-xs text-gray-400">({p.sku})</span></span>
                <Badge label="Out of Stock" variant="red" />
              </div>
            ))}
            {lowStock.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{p.name} <span className="font-mono text-xs text-gray-400">({p.sku})</span></span>
                <Badge label={`${p.stock_on_hand} left`} variant="yellow" />
              </div>
            ))}
          </div>
          <Link to="/inventory" className="mt-3 inline-block text-xs text-yellow-700 underline">View inventory →</Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Sales</h2>
            <Link to="/sales" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </div>
          {recentSales.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No sales yet</p>
          ) : (
            <div className="space-y-3">
              {recentSales.map(s => (
                <div key={s.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                  <div>
                    <div className="font-medium text-gray-800">{s.product_name}</div>
                    <div className="text-xs text-gray-400">{s.sale_date} · {s.quantity_sold}x @ ₱{fmt(s.sale_price_php)}</div>
                  </div>
                  <span className={`font-semibold ${s.net_profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    ₱{fmt(s.net_profit)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inventory Snapshot */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Inventory Snapshot</h2>
            <Link to="/inventory" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </div>
          {inventory.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No products</p>
          ) : (
            <div className="space-y-3">
              {inventory.slice(0, 6).map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                  <div>
                    <div className="font-medium text-gray-800">{p.name}</div>
                    <div className="text-xs text-gray-400 font-mono">{p.sku}</div>
                  </div>
                  <div className="text-right">
                    <Badge
                      label={`${p.stock_on_hand} in stock`}
                      variant={p.stock_on_hand === 0 ? 'red' : p.stock_on_hand < 5 ? 'yellow' : 'green'}
                    />
                    {p.stock_on_hand > 0 && (
                      <div className="text-xs text-gray-400 mt-0.5">₱{fmt(p.inventory_value_php)} value</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
