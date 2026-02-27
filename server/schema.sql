CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sku         TEXT    NOT NULL UNIQUE,
    name        TEXT    NOT NULL,
    category    TEXT,
    description TEXT,
    unit        TEXT    NOT NULL DEFAULT 'piece',
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_batches (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id       INTEGER NOT NULL REFERENCES products(id),
    purchase_date    TEXT    NOT NULL,
    quantity         INTEGER NOT NULL CHECK (quantity > 0),
    remaining_qty    INTEGER NOT NULL,
    unit_price_aud   REAL    NOT NULL,
    exchange_rate    REAL    NOT NULL,
    shipping_aud     REAL    NOT NULL DEFAULT 0,
    customs_php      REAL    NOT NULL DEFAULT 0,
    notes            TEXT,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id        INTEGER NOT NULL REFERENCES products(id),
    sale_date         TEXT    NOT NULL,
    quantity_sold     INTEGER NOT NULL CHECK (quantity_sold > 0),
    sale_price_php    REAL    NOT NULL,
    delivery_cost_php REAL    NOT NULL DEFAULT 0,
    notes             TEXT,
    created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sale_batch_allocations (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id                  INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    batch_id                 INTEGER NOT NULL REFERENCES purchase_batches(id),
    units_taken              INTEGER NOT NULL,
    landed_cost_per_unit_php REAL    NOT NULL
);

CREATE TABLE IF NOT EXISTS exchange_rate_cache (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    rate       REAL NOT NULL,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
