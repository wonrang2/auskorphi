import { useState, useEffect, useCallback } from 'react';
import api from '../api/client.js';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import FormField from '../components/FormField.jsx';
import Badge from '../components/Badge.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const emptyForm = { username: '', password: '', role: 'user' };

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // null | 'add' | 'edit'
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/users')
      .then(r => setUsers(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setForm(emptyForm);
    setFormError('');
    setEditing(null);
    setModal('form');
  }

  function openEdit(user) {
    setForm({ username: user.username, password: '', role: user.role });
    setFormError('');
    setEditing(user);
    setModal('form');
  }

  function closeModal() { setModal(null); setEditing(null); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.username.trim()) { setFormError('Username is required.'); return; }
    if (!editing && !form.password) { setFormError('Password is required for new users.'); return; }
    setSaving(true);
    setFormError('');
    try {
      const payload = { username: form.username.trim(), role: form.role };
      if (form.password) payload.password = form.password;
      if (editing) {
        await api.put(`/users/${editing.id}`, payload);
      } else {
        await api.post('/users', payload);
      }
      closeModal();
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user) {
    if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${user.id}`);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  const columns = [
    { key: 'username', label: 'Username', render: r => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{r.username}</span>
          {String(r.id) === String(me?.id) && (
            <span className="text-xs text-gray-400">(you)</span>
          )}
        </div>
      )
    },
    { key: 'role', label: 'Role', render: r => (
        <Badge label={r.role} variant={r.role === 'admin' ? 'blue' : 'gray'} />
      )
    },
    { key: 'created_at', label: 'Created', mobileHide: true, render: r => r.created_at.slice(0, 10) },
    { key: 'actions', label: '', render: r => (
        <div className="flex gap-2 justify-end">
          <button onClick={() => openEdit(r)} className="btn-secondary text-xs px-3 py-1">Edit</button>
          <button
            onClick={() => handleDelete(r)}
            disabled={String(r.id) === String(me?.id)}
            className="btn-danger text-xs px-3 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Delete
          </button>
        </div>
      )
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage who can access Auskorphi</p>
        </div>
        <button onClick={openAdd} className="btn-primary shrink-0">+ Add User</button>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <DataTable columns={columns} rows={users} emptyMessage="No users found." />
      )}

      {modal === 'form' && (
        <Modal title={editing ? 'Edit User' : 'Add User'} onClose={closeModal}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Username *">
              <input
                className="input"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="e.g. maria"
                autoComplete="off"
              />
            </FormField>

            <FormField
              label={editing ? 'New Password' : 'Password *'}
              hint={editing ? 'Leave blank to keep current password' : ''}
            >
              <input
                type="password"
                className="input"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={editing ? 'Leave blank to keep unchanged' : 'Min 6 characters'}
                autoComplete="new-password"
              />
            </FormField>

            <FormField label="Role">
              <select
                className="input"
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              >
                <option value="user">User — can view and record data</option>
                <option value="admin">Admin — full access including user management</option>
              </select>
            </FormField>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add User'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
