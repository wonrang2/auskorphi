import { useState, useEffect, useCallback } from 'react';
import api from '../api/client.js';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';

function fmt(n, dec = 2) {
  return Number(n).toLocaleString('en-PH', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null); // { product, batches }
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/inventory')
      .then(r => setInventory(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openDetail(product) {
    setDetailLoading(true);
    setDetail({ product, batches: [] });
    try {
      const r = await api.get(`/inventory/${product.id}`);
      setDetail(r.data);
    } catch (err) {
      alert(err.message);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  const totalValue = inventory.reduce((s, r) => s + r.inventory_value_php, 0);

  const columns = [
    { key: 'sku',     label: 'SKU',     render: r => <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{r.sku}</span> },
    { key: 'name',    label: 'Product', render: r => <span className="font-medium">{r.name}</span> },
    { key: 'category',label: 'Category',render: r => r.category || <span className="text-gray-400">—</span> },
    { key: 'stock',   label: 'Stock',   render: r => (
        <Badge
          label={`${r.stock_on_hand} ${r.unit}`}
          variant={r.stock_on_hand === 0 ? 'red' : r.stock_on_hand < 5 ? 'yellow' : 'green'}
        />
      )
    },
    { key: 'avg_cost',label: 'Avg Landed Cost', render: r => (
        r.stock_on_hand > 0 ? <span className="text-blue-700 font-medium">₱{fmt(r.avg_landed_cost_php)}</span>
          : <span className="text-gray-400">—</span>
      )
    },
    { key: 'value',   label: 'Inventory Value', render: r => (
        r.stock_on_hand > 0
          ? <span className="font-semibold text-gray-800">₱{fmt(r.inventory_value_php)}</span>
          : <span className="text-gray-400">—</span>
      )
    },
    { key: 'actions', label: '', render: r => (
        r.stock_on_hand > 0
          ? <button onClick={() => openDetail(r)} className="btn-secondary text-xs px-3 py-1">View Batches</button>
          : null
      )
    },
  ];

  const batchColumns = [
    { key: 'purchase_date', label: 'Purchase Date' },
    { key: 'remaining_qty', label: 'Remaining',    render: r => `${r.remaining_qty} / ${r.quantity}` },
    { key: 'unit_price_aud',label: 'Unit Price',   render: r => `AUD ${fmt(r.unit_price_aud)}` },
    { key: 'exchange_rate', label: 'Rate',         render: r => fmt(r.exchange_rate, 4) },
    { key: 'landed',        label: 'Landed/unit',  render: r => <span className="font-semibold text-blue-700">₱{fmt(r.landed_cost_per_unit_php)}</span> },
    { key: 'rem_value',     label: 'Remaining Value', render: r => <span className="font-semibold">₱{fmt(r.remaining_value_php)}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">Current stock levels and landed cost averages</p>
        </div>
        <div className="card text-right py-3 px-5">
          <p className="text-xs text-gray-500 uppercase font-semibold">Total Inventory Value</p>
          <p className="text-xl font-bold text-gray-900">₱{fmt(totalValue)}</p>
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <DataTable columns={columns} rows={inventory} emptyMessage="No inventory. Add products and batches first." />
      )}

      {detail && (
        <Modal title={`Batch Breakdown — ${detail.product?.name || ''}`} onClose={() => setDetail(null)} size="xl">
          {detailLoading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : (
            <DataTable columns={batchColumns} rows={detail.batches} emptyMessage="No active batches." />
          )}
        </Modal>
      )}
    </div>
  );
}
