require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(process.env.DB_PATH || './auskorphi.db');
const db = new Database(dbPath);

// Performance and integrity settings
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

// Initialize schema
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Seed default admin if no users exist
const { cnt } = db.prepare('SELECT COUNT(*) AS cnt FROM users').get();
if (cnt === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare("INSERT INTO users (username, password, role) VALUES ('admin', ?, 'admin')").run(hash);
  console.log('Seeded default admin user (admin / admin123)');
}

module.exports = db;
