// src/db/init.js
//
// This script creates the SQLite database file and all tables.
// Run it once with: npm run init-db
//
// WHY SQLite for this project:
// - Zero setup (no separate DB server to install/manage)
// - File-based, so it's trivial to back up or inspect
// - better-sqlite3 is synchronous, which actually makes the lottery
//   draw logic SAFER (no race conditions from async DB calls mid-transaction)
// - You can migrate to Postgres/MySQL later — the SQL here is close to standard ANSI SQL

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "..", "data", "lucky_loop.db");

// Make sure the /data folder exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// WAL mode = better concurrency (readers don't block writers)
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT UNIQUE NOT NULL,
  username TEXT,
  coins INTEGER NOT NULL DEFAULT 0,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by INTEGER,             -- FK to users.id, nullable
  referral_count INTEGER NOT NULL DEFAULT 0,
  wallet_address TEXT,
  device_fingerprint TEXT,         -- anti-multi-account signal
  last_spin_at TEXT,               -- ISO timestamp, for daily earn limits
  daily_coins_earned INTEGER NOT NULL DEFAULT 0,
  daily_earn_reset_at TEXT,
  is_banned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (referred_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  draw_date TEXT NOT NULL,         -- 'YYYY-MM-DD', the lottery day this ticket belongs to
  ticket_number INTEGER NOT NULL,  -- 1..TOTAL_TICKETS_PER_DAY, which physical slot was bought
  price_paid INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE (draw_date, ticket_number)  -- <-- this line PREVENTS double-selling a slot
);

CREATE TABLE IF NOT EXISTS draws (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draw_date TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',  -- open | closed | drawn
  total_tickets_sold INTEGER NOT NULL DEFAULT 0,
  winner_user_id INTEGER,
  winner_ticket_id INTEGER,
  random_seed TEXT,                -- stored BEFORE the draw runs (commit step)
  server_seed_hash TEXT,            -- sha256(seed) published early, proves no tampering
  reward_amount INTEGER,
  closed_at TEXT,
  drawn_at TEXT,
  FOREIGN KEY (winner_user_id) REFERENCES users(id),
  FOREIGN KEY (winner_ticket_id) REFERENCES tickets(id)
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  coins_spent INTEGER NOT NULL,
  token_amount INTEGER NOT NULL,
  wallet_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | sent | rejected | failed
  tx_hash TEXT,
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS coin_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,          -- positive = credit, negative = debit
  reason TEXT NOT NULL,             -- 'spin', 'ticket_purchase', 'referral_bonus', 'lottery_win', 'withdrawal'
  reference_id INTEGER,             -- optional FK to ticket/withdrawal/draw id
  balance_after INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_tickets_user_date ON tickets(user_id, draw_date);
CREATE INDEX IF NOT EXISTS idx_tickets_draw_date ON tickets(draw_date);
CREATE INDEX IF NOT EXISTS idx_coin_tx_user ON coin_transactions(user_id);


CREATE TABLE IF NOT EXISTS jackpots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start TEXT UNIQUE NOT NULL,   -- 'YYYY-MM-DD', Monday of that week
  week_end TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',  -- open | closed | drawn
  pool_amount INTEGER NOT NULL DEFAULT 0,
  winner_user_id INTEGER,
  random_seed TEXT,
  server_seed_hash TEXT,
  closed_at TEXT,
  drawn_at TEXT,
  FOREIGN KEY (winner_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_jackpots_week ON jackpots(week_start);
`);

console.log(`✅ Database initialized at: ${DB_PATH}`);
db.close();
