const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

// All routes in here require admin role
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

router.use(requireAdmin);

// GET /api/users
router.get('/', (req, res) => {
  const users = db.prepare(
    'SELECT id, username, role, created_at FROM users ORDER BY created_at ASC'
  ).all();
  res.json(users);
});

// POST /api/users
router.post('/', (req, res) => {
  const { username, password, role = 'user' } = req.body;
  if (!username?.trim() || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or user' });
  }
  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare(
      "INSERT INTO users (username, password, role) VALUES (?, ?, ?)"
    ).run(username.trim(), hash, role);
    const user = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(user);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: `Username "${username}" is already taken` });
    }
    throw err;
  }
});

// PUT /api/users/:id
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { username, password, role } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (!username?.trim()) {
    return res.status(400).json({ error: 'Username is required' });
  }
  if (role && !['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or user' });
  }

  // Prevent removing admin role from the last admin
  if (user.role === 'admin' && role === 'user') {
    const { cnt } = db.prepare("SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin'").get();
    if (cnt <= 1) {
      return res.status(409).json({ error: 'Cannot demote the last admin account' });
    }
  }

  const newHash = password ? bcrypt.hashSync(password, 10) : user.password;
  try {
    db.prepare(
      'UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?'
    ).run(username.trim(), newHash, role ?? user.role, id);
    const updated = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: `Username "${username}" is already taken` });
    }
    throw err;
  }
});

// DELETE /api/users/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  if (String(id) === String(req.user.id)) {
    return res.status(409).json({ error: 'You cannot delete your own account' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.role === 'admin') {
    const { cnt } = db.prepare("SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin'").get();
    if (cnt <= 1) {
      return res.status(409).json({ error: 'Cannot delete the last admin account' });
    }
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ success: true });
});

module.exports = router;
