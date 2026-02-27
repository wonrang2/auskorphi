import { useState, useEffect, useCallback } from 'react';
import api from '../api/client.js';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import FormField from '../components/FormField.jsx';
import Badge from '../components/Badge.jsx';

const UNITS = ['piece', 'pair', 'set', 'box', 'kg', 'litre', 'pack'];

const emptyForm = { sku: '', name: '', category: '', description: '', unit: 'piece' };

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // null | 'add' | 'edit'
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/products')
      .then(r => setProducts(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setForm(emptyForm);
    setFormError('');
    setEditing(null);
    setModal('edit');
  }

  function openEdit(product) {
    setForm({
      sku: product.sku,
      name: product.name,
      category: product.category || '',
      description: product.description || '',
      unit: product.unit,
    });
    setFormError('');
    setEditing(product);
    setModal('edit');
  }

  function closeModal() {
    setModal(null);
    setEditing(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.sku.trim() || !form.name.trim()) {
      setFormError('SKU and Name are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await api.put(`/products/${editing.id}`, form);
      } else {
        await api.post('/products', form);
      }
      closeModal();
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(product) {
    if (!confirm(`Archive product "${product.name}"? It will no longer appear in lists.`)) return;
    try {
      await api.delete(`/products/${product.id}`);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  const columns = [
    { key: 'sku',           label: 'SKU',      render: r => <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{r.sku}</span> },
    { key: 'name',          label: 'Name',     render: r => <span className="font-medium">{r.name}</span> },
    { key: 'category',      label: 'Category', render: r => r.category || <span className="text-gray-400">—</span> },
    { key: 'unit',          label: 'Unit',     render: r => <Badge label={r.unit} variant="blue" /> },
    { key: 'stock_on_hand', label: 'Stock',    render: r => (
        <Badge
          label={`${r.stock_on_hand} in stock`}
          variant={r.stock_on_hand === 0 ? 'red' : r.stock_on_hand < 5 ? 'yellow' : 'green'}
        />
      )
    },
    { key: 'actions', label: '', render: r => (
        <div className="flex gap-2 justify-end">
          <button onClick={() => openEdit(r)} className="btn-secondary text-xs px-3 py-1">Edit</button>
          <button onClick={() => handleDelete(r)} className="btn-danger text-xs px-3 py-1">Archive</button>
        </div>
      )
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your product catalogue</p>
        </div>
        <button onClick={openAdd} className="btn-primary">+ Add Product</button>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <DataTable columns={columns} rows={products} emptyMessage="No products yet. Add your first product above." />
      )}

      {modal === 'edit' && (
        <Modal title={editing ? 'Edit Product' : 'Add Product'} onClose={closeModal}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="SKU *" error={!form.sku.trim() && formError ? 'Required' : ''}>
                <input
                  className="input"
                  value={form.sku}
                  onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                  placeholder="e.g. SHOE-001"
                />
              </FormField>
              <FormField label="Unit">
                <select
                  className="input"
                  value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                >
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </FormField>
            </div>

            <FormField label="Name *">
              <input
                className="input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Product name"
              />
            </FormField>

            <FormField label="Category">
              <input
                className="input"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Footwear"
              />
            </FormField>

            <FormField label="Description">
              <textarea
                className="input"
                rows={2}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional notes"
              />
            </FormField>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
