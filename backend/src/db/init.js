// src/db/init.js
//
// Creates all tables on the configured Turso database (idempotent — safe
// to run on every boot). Exports an async `initDb()` instead of running
// at require-time, since talking to Turso means every statement is a
// network call.
//
// Run standalone with: npm run init-db
const db = require("./connection");
const { runMigrations } = require("./migrate");

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT UNIQUE,          -- nullable: wallet-only players have no Telegram identity
  username TEXT,
  coins INTEGER NOT NULL DEFAULT 0,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by INTEGER,             -- FK to users.id, nullable
  referral_count INTEGER NOT NULL DEFAULT 0,
  wallet_address TEXT,             -- unique when set (see idx_users_wallet_address_unique below);
                                    -- doubles as this user's login identity when telegram_id is absent
  device_fingerprint TEXT,         -- anti-multi-account signal
  last_spin_at TEXT,               -- ISO timestamp, for daily earn limits
  daily_coins_earned INTEGER NOT NULL DEFAULT 0,
  daily_earn_reset_at TEXT,
  is_banned INTEGER NOT NULL DEFAULT 0,
  is_admin INTEGER NOT NULL DEFAULT 0,   -- granted in-app via the admin panel (see promote/demote), not hardcoded
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (referred_by) REFERENCES users(id),
  CHECK (telegram_id IS NOT NULL OR wallet_address IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wallet_address_unique
  ON users(wallet_address) WHERE wallet_address IS NOT NULL;

-- One-time login nonces for "Sign-In With Wallet". A wallet proves it owns
-- an address by signing the nonce issued here; without this, anyone could
-- claim any address in a login request and there'd be nothing to check it
-- against. Rows are single-use and short-lived (see walletAuth.js).
CREATE TABLE IF NOT EXISTS wallet_login_nonces (
  wallet_address TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  reason TEXT NOT NULL,             -- 'spin', 'ticket_purchase', 'referral_bonus', 'lottery_win', 'withdrawal', 'onchain_deposit', 'fiat_deposit'
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

CREATE TABLE IF NOT EXISTS onchain_deposits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  amount_scai_wei TEXT NOT NULL,
  coins_credited INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_onchain_deposits_user ON onchain_deposits(user_id);

-- fiat (Stripe) deposits. One row per checkout session; a session only
-- ever credits coins once (see stripeService.creditFiatDeposit), keyed on
-- the UNIQUE stripe_session_id so a duplicated/replayed webhook is a no-op.
CREATE TABLE IF NOT EXISTS fiat_deposits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  stripe_session_id TEXT NOT NULL UNIQUE,
  stripe_payment_intent_id TEXT,
  amount_usd_cents INTEGER NOT NULL,
  coins_credited INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | completed | failed | expired
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_fiat_deposits_user ON fiat_deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_fiat_deposits_status ON fiat_deposits(status);
`;

async function initDb() {
  await db.pragma("foreign_keys = ON");
  await db.exec(SCHEMA_SQL);

  // Handles schema changes that CREATE TABLE IF NOT EXISTS can't express
  // (e.g. relaxing a NOT NULL constraint on an existing column). Safe to
  // run every boot - each step checks whether it's already applied first.
  await runMigrations(db);

  console.log(`✅ Database initialized (Turso: ${process.env.TURSO_DATABASE_URL})`);
}

module.exports = { initDb };

// Allow `npm run init-db` / `node src/db/init.js` to run this standalone.
if (require.main === module) {
  initDb()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("FATAL: Database initialization failed:", err);
      process.exit(1);
    });
}