import { useState } from 'react';
import Modal from './Modal.jsx';
import FormField from './FormField.jsx';
import api from '../api/client.js';

export default function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.new_password.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (form.new_password !== form.confirm_password) {
      setError('New passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await api.put('/auth/password', {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Change Password" onClose={onClose} size="sm">
      {success ? (
        <div className="text-center space-y-4 py-2">
          <div className="text-3xl">✅</div>
          <p className="text-sm text-gray-700 font-medium">Password changed successfully.</p>
          <button onClick={onClose} className="btn-primary w-full">Done</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Current Password">
            <input
              type="password"
              className="input"
              autoComplete="current-password"
              value={form.current_password}
              onChange={e => setForm(f => ({ ...f, current_password: e.target.value }))}
              required
            />
          </FormField>

          <FormField label="New Password">
            <input
              type="password"
              className="input"
              autoComplete="new-password"
              placeholder="Min 6 characters"
              value={form.new_password}
              onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))}
              required
            />
          </FormField>

          <FormField label="Confirm New Password">
            <input
              type="password"
              className="input"
              autoComplete="new-password"
              value={form.confirm_password}
              onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))}
              required
            />
          </FormField>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Change Password'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
