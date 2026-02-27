require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(process.env.DB_PATH || './auskorphi.db');
const db = new Database(dbPath);

// Performance and integrity settings
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

// Initialize schema
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

module.exports = db;
