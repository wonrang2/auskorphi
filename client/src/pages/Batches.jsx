import { useState, useEffect, useCallback } from 'react';
import api from '../api/client.js';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import FormField from '../components/FormField.jsx';
import ExchangeRateDisplay from '../components/ExchangeRateDisplay.jsx';
import Badge from '../components/Badge.jsx';

const emptyForm = {
  product_id: '',
  purchase_date: new Date().toISOString().slice(0, 10),
  quantity: '',
  unit_price_aud: '',
  exchange_rate: '',
  shipping_aud: '',
  customs_php: '',
  notes: '',
};

function fmt(n, dec = 2) {
  return Number(n).toLocaleString('en-PH', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function Batches() {
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [liveRate, setLiveRate] = useState(null);
  const [filterProduct, setFilterProduct] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = filterProduct ? `?product_id=${filterProduct}` : '';
    Promise.all([
      api.get(`/batches${params}`),
      api.get('/products'),
    ])
      .then(([b, p]) => {
        setBatches(b.data);
        setProducts(p.data);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [filterProduct]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setForm({ ...emptyForm, exchange_rate: liveRate ? String(liveRate) : '', purchase_date: new Date().toISOString().slice(0, 10) });
    setFormError('');
    setEditing(null);
    setModal(true);
  }

  function openEdit(batch) {
    setForm({
      product_id: String(batch.product_id),
      purchase_date: batch.purchase_date,
      quantity: String(batch.quantity),
      unit_price_aud: String(batch.unit_price_aud),
      exchange_rate: String(batch.exchange_rate),
      shipping_aud: String(batch.shipping_aud),
      customs_php: String(batch.customs_php),
      notes: batch.notes || '',
    });
    setFormError('');
    setEditing(batch);
    setModal(true);
  }

  function closeModal() { setModal(false); setEditing(null); }

  // Landed cost preview
  const preview = (() => {
    const qty = parseFloat(form.quantity);
    const price = parseFloat(form.unit_price_aud);
    const rate = parseFloat(form.exchange_rate);
    const ship = parseFloat(form.shipping_aud) || 0;
    const cust = parseFloat(form.customs_php) || 0;
    if (!qty || !price || !rate) return null;
    const landed = (price * rate) + (ship * rate / qty) + (cust / qty);
    return { landed, total: landed * qty };
  })();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.product_id || !form.quantity || !form.unit_price_aud || !form.exchange_rate) {
      setFormError('Product, quantity, unit price, and exchange rate are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    const payload = {
      product_id: parseInt(form.product_id),
      purchase_date: form.purchase_date,
      quantity: parseInt(form.quantity),
      unit_price_aud: parseFloat(form.unit_price_aud),
      exchange_rate: parseFloat(form.exchange_rate),
      shipping_aud: parseFloat(form.shipping_aud) || 0,
      customs_php: parseFloat(form.customs_php) || 0,
      notes: form.notes || null,
    };
    try {
      if (editing) {
        await api.put(`/batches/${editing.id}`, payload);
      } else {
        await api.post('/batches', payload);
      }
      closeModal();
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(batch) {
    if (!confirm(`Delete batch from ${batch.purchase_date}? This cannot be undone.`)) return;
    try {
      await api.delete(`/batches/${batch.id}`);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  const columns = [
    { key: 'purchase_date',  label: 'Date' },
    { key: 'product_name',   label: 'Product', render: r => (
        <div>
          <div className="font-medium">{r.product_name}</div>
          <div className="text-xs text-gray-400 font-mono">{r.sku}</div>
        </div>
      )
    },
    { key: 'quantity',       label: 'Qty', render: r => (
        <div>
          <div>{r.quantity} purchased</div>
          <div className="text-xs text-gray-400">{r.remaining_qty} remaining</div>
        </div>
      )
    },
    { key: 'unit_price_aud', label: 'Unit Price', mobileHide: true, render: r => `AUD ${fmt(r.unit_price_aud)}` },
    { key: 'exchange_rate',  label: 'Rate',        mobileHide: true, render: r => `${fmt(r.exchange_rate, 4)}` },
    { key: 'landed',         label: 'Landed/unit', render: r => (
        <span className="font-semibold text-blue-700">₱{fmt(r.landed_cost_per_unit_php)}</span>
      )
    },
    { key: 'status', label: 'Status', render: r => (
        r.remaining_qty === 0
          ? <Badge label="Depleted" variant="gray" />
          : r.remaining_qty < r.quantity
          ? <Badge label="Partial" variant="yellow" />
          : <Badge label="Full" variant="green" />
      )
    },
    { key: 'actions', label: '', render: r => (
        <div className="flex gap-2 justify-end">
          <button onClick={() => openEdit(r)} className="btn-secondary text-xs px-3 py-1">Edit</button>
          <button onClick={() => handleDelete(r)} className="btn-danger text-xs px-3 py-1">Delete</button>
        </div>
      )
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Batches</h1>
          <p className="text-sm text-gray-500 mt-1">Track inventory by purchase batch for FIFO costing</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ExchangeRateDisplay onRate={setLiveRate} />
          <button onClick={openAdd} className="btn-primary shrink-0">+ Record Batch</button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <select
          className="input w-full sm:w-56"
          value={filterProduct}
          onChange={e => setFilterProduct(e.target.value)}
        >
          <option value="">All products</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <DataTable columns={columns} rows={batches} emptyMessage="No batches yet." />
      )}

      {modal && (
        <Modal title={editing ? 'Edit Batch' : 'Record Purchase Batch'} onClose={closeModal} size="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Product *">
                <select
                  className="input"
                  value={form.product_id}
                  onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
                >
                  <option value="">Select product...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
              </FormField>
              <FormField label="Purchase Date *">
                <input
                  type="date"
                  className="input"
                  value={form.purchase_date}
                  onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Quantity *">
                <input
                  type="number" min="1" className="input"
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                  placeholder="0"
                />
              </FormField>
              <FormField label="Unit Price (AUD) *">
                <input
                  type="number" step="0.01" min="0" className="input"
                  value={form.unit_price_aud}
                  onChange={e => setForm(f => ({ ...f, unit_price_aud: e.target.value }))}
                  placeholder="0.00"
                />
              </FormField>
              <FormField label="AUD→PHP Rate *" hint="Auto-filled from live rate">
                <input
                  type="number" step="0.0001" min="0" className="input"
                  value={form.exchange_rate}
                  onChange={e => setForm(f => ({ ...f, exchange_rate: e.target.value }))}
                  placeholder="e.g. 38.50"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Shipping Cost (AUD)" hint="Allocated proportionally across units">
                <input
                  type="number" step="0.01" min="0" className="input"
                  value={form.shipping_aud}
                  onChange={e => setForm(f => ({ ...f, shipping_aud: e.target.value }))}
                  placeholder="0.00"
                />
              </FormField>
              <FormField label="Customs / Duties (PHP)" hint="Allocated proportionally across units">
                <input
                  type="number" step="0.01" min="0" className="input"
                  value={form.customs_php}
                  onChange={e => setForm(f => ({ ...f, customs_php: e.target.value }))}
                  placeholder="0.00"
                />
              </FormField>
            </div>

            {preview && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-blue-600 font-semibold uppercase">Landed Cost / Unit</p>
                  <p className="text-xl font-bold text-blue-800">₱{fmt(preview.landed)}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-semibold uppercase">Total Landed Cost</p>
                  <p className="text-xl font-bold text-blue-800">₱{fmt(preview.total)}</p>
                </div>
              </div>
            )}

            <FormField label="Notes">
              <textarea
                className="input" rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional"
              />
            </FormField>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Record Batch'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
