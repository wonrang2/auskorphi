import { useState, useEffect, useCallback } from 'react';
import api from '../api/client.js';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import FormField from '../components/FormField.jsx';
import Badge from '../components/Badge.jsx';

function fmt(n, dec = 2) {
  return Number(n).toLocaleString('en-PH', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

const emptyForm = {
  product_id: '',
  sale_date: new Date().toISOString().slice(0, 10),
  quantity_sold: '',
  sale_price_php: '',
  delivery_cost_php: '',
  notes: '',
};

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [filterProduct, setFilterProduct] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterProduct) params.set('product_id', filterProduct);
    if (filterFrom) params.set('from', filterFrom);
    if (filterTo) params.set('to', filterTo);
    const qs = params.toString() ? `?${params}` : '';

    Promise.all([
      api.get(`/sales${qs}`),
      api.get('/products'),
      api.get('/inventory'),
    ])
      .then(([s, p, inv]) => {
        setSales(s.data);
        setProducts(p.data);
        setInventory(inv.data);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [filterProduct, filterFrom, filterTo]);

  useEffect(() => { load(); }, [load]);

  // When editing, add back the original quantity so stock check is accurate
  const selectedProductStock = (() => {
    const inv = inventory.find(i => String(i.id) === String(form.product_id));
    if (inv == null) return null;
    const base = inv.stock_on_hand;
    if (editing && String(editing.product_id) === String(form.product_id)) {
      return base + editing.quantity_sold;
    }
    return base;
  })();

  function openAdd() {
    setForm({ ...emptyForm, sale_date: new Date().toISOString().slice(0, 10) });
    setFormError('');
    setEditing(null);
    setModal(true);
  }

  function openEdit(sale) {
    setForm({
      product_id: String(sale.product_id),
      sale_date: sale.sale_date,
      quantity_sold: String(sale.quantity_sold),
      sale_price_php: String(sale.sale_price_php),
      delivery_cost_php: String(sale.delivery_cost_php || ''),
      notes: sale.notes || '',
    });
    setFormError('');
    setEditing(sale);
    setModal(true);
  }

  function closeModal() { setModal(false); setEditing(null); }

  // Revenue/profit preview
  const preview = (() => {
    const qty = parseFloat(form.quantity_sold);
    const price = parseFloat(form.sale_price_php);
    const delivery = parseFloat(form.delivery_cost_php) || 0;
    if (!qty || !price) return null;
    return { revenue: qty * price, netAfterDelivery: qty * price - delivery };
  })();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.product_id || !form.quantity_sold || !form.sale_price_php) {
      setFormError('Product, quantity, and sale price are required.');
      return;
    }
    const qty = parseInt(form.quantity_sold);
    if (selectedProductStock !== null && qty > selectedProductStock) {
      setFormError(`Insufficient stock. Available: ${selectedProductStock}`);
      return;
    }
    setSaving(true);
    setFormError('');
    const payload = {
      product_id: parseInt(form.product_id),
      sale_date: form.sale_date,
      quantity_sold: qty,
      sale_price_php: parseFloat(form.sale_price_php),
      delivery_cost_php: parseFloat(form.delivery_cost_php) || 0,
      notes: form.notes || null,
    };
    try {
      if (editing) {
        await api.put(`/sales/${editing.id}`, payload);
      } else {
        await api.post('/sales', payload);
      }
      closeModal();
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleVoid(sale) {
    if (!confirm(`Void sale of ${sale.quantity_sold}x ${sale.product_name} on ${sale.sale_date}? Stock will be restored.`)) return;
    try {
      await api.delete(`/sales/${sale.id}`);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  const totalRevenue = sales.reduce((s, r) => s + r.revenue, 0);
  const totalProfit = sales.reduce((s, r) => s + r.net_profit, 0);

  const columns = [
    { key: 'sale_date',     label: 'Date' },
    { key: 'product_name',  label: 'Product', render: r => (
        <div>
          <div className="font-medium">{r.product_name}</div>
          <div className="text-xs text-gray-400 font-mono hidden sm:block">{r.sku}</div>
        </div>
      )
    },
    { key: 'quantity_sold', label: 'Qty',     mobileHide: true, render: r => `${r.quantity_sold}x @ ₱${fmt(r.sale_price_php)}` },
    { key: 'revenue',       label: 'Revenue', mobileHide: true, render: r => <span className="font-medium">₱{fmt(r.revenue)}</span> },
    { key: 'cogs',          label: 'COGS',    mobileHide: true, render: r => <span className="text-gray-600">₱{fmt(r.cogs)}</span> },
    { key: 'gross_profit',  label: 'Gross',   mobileHide: true, render: r => (
        <span className={r.gross_profit >= 0 ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
          ₱{fmt(r.gross_profit)}
        </span>
      )
    },
    { key: 'net_profit',    label: 'Net',     render: r => (
        <span className={r.net_profit >= 0 ? 'text-green-700 font-bold' : 'text-red-600 font-bold'}>
          ₱{fmt(r.net_profit)}
        </span>
      )
    },
    { key: 'margin', label: 'Margin', mobileHide: true, render: r => (
        r.revenue > 0
          ? <Badge
              label={`${((r.net_profit / r.revenue) * 100).toFixed(1)}%`}
              variant={r.net_profit >= 0 ? 'green' : 'red'}
            />
          : null
      )
    },
    { key: 'actions', label: '', render: r => (
        <div className="flex gap-2 justify-end">
          <button onClick={() => openEdit(r)} className="btn-secondary text-xs px-3 py-1">Edit</button>
          <button onClick={() => handleVoid(r)} className="btn-danger text-xs px-3 py-1">Void</button>
        </div>
      )
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales</h1>
          <p className="text-sm text-gray-500 mt-1">Record sales and track profit per transaction</p>
        </div>
        <button onClick={openAdd} className="btn-primary shrink-0">+ Record Sale</button>
      </div>

      {/* Summary bar */}
      {sales.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center py-3">
            <p className="text-xs text-gray-500 font-semibold uppercase">Revenue</p>
            <p className="text-lg font-bold text-gray-900">₱{fmt(totalRevenue)}</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-xs text-gray-500 font-semibold uppercase">Net Profit</p>
            <p className={`text-lg font-bold ${totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>₱{fmt(totalProfit)}</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-xs text-gray-500 font-semibold uppercase">Net Margin</p>
            <p className={`text-lg font-bold ${totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}%
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select className="input w-full sm:w-48" value={filterProduct} onChange={e => setFilterProduct(e.target.value)}>
          <option value="">All products</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" className="input w-40" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" className="input w-40" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
        </div>
        {(filterProduct || filterFrom || filterTo) && (
          <button className="btn-secondary text-xs" onClick={() => { setFilterProduct(''); setFilterFrom(''); setFilterTo(''); }}>
            Clear filters
          </button>
        )}
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <DataTable columns={columns} rows={sales} emptyMessage="No sales recorded yet." />
      )}

      {modal && (
        <Modal title={editing ? 'Edit Sale' : 'Record Sale'} onClose={closeModal} size="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Product *">
                <select
                  className="input"
                  value={form.product_id}
                  onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
                >
                  <option value="">Select product...</option>
                  {products.map(p => {
                    const stock = inventory.find(i => i.id === p.id)?.stock_on_hand ?? 0;
                    return (
                      <option key={p.id} value={p.id} disabled={stock === 0}>
                        {p.name} ({stock} in stock)
                      </option>
                    );
                  })}
                </select>
              </FormField>
              <FormField label="Sale Date *">
                <input
                  type="date" className="input"
                  value={form.sale_date}
                  onChange={e => setForm(f => ({ ...f, sale_date: e.target.value }))}
                />
              </FormField>
            </div>

            {form.product_id && selectedProductStock !== null && (
              <div className="flex items-center gap-2">
                <Badge
                  label={`${selectedProductStock} in stock`}
                  variant={selectedProductStock === 0 ? 'red' : selectedProductStock < 5 ? 'yellow' : 'green'}
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Quantity *">
                <input
                  type="number" min="1" className="input"
                  value={form.quantity_sold}
                  onChange={e => setForm(f => ({ ...f, quantity_sold: e.target.value }))}
                  placeholder="0"
                />
              </FormField>
              <FormField label="Sale Price / Unit (PHP) *">
                <input
                  type="number" step="0.01" min="0" className="input"
                  value={form.sale_price_php}
                  onChange={e => setForm(f => ({ ...f, sale_price_php: e.target.value }))}
                  placeholder="0.00"
                />
              </FormField>
              <FormField label="Delivery Cost (PHP)">
                <input
                  type="number" step="0.01" min="0" className="input"
                  value={form.delivery_cost_php}
                  onChange={e => setForm(f => ({ ...f, delivery_cost_php: e.target.value }))}
                  placeholder="0.00"
                />
              </FormField>
            </div>

            {preview && (
              <div className="bg-green-50 border border-green-100 rounded-lg p-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-green-600 font-semibold uppercase">Gross Revenue</p>
                  <p className="text-xl font-bold text-green-800">₱{fmt(preview.revenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-green-600 font-semibold uppercase">After Delivery</p>
                  <p className="text-xl font-bold text-green-800">₱{fmt(preview.netAfterDelivery)}</p>
                </div>
              </div>
            )}

            <FormField label="Notes">
              <textarea
                className="input" rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional (platform, buyer, etc.)"
              />
            </FormField>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Record Sale'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
