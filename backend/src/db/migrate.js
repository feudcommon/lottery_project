// src/db/migrate.js
//
// Schema migrations that can't be expressed as `CREATE TABLE IF NOT EXISTS`
// (SQLite has no ALTER COLUMN, so relaxing a NOT NULL constraint means
// rebuilding the table). Everything here is written to be safe to run on
// every boot against a database that may already have real user data:
//   - each migration checks whether it's already applied before touching
//     anything
//   - the rebuild runs inside a single transaction with foreign_keys OFF,
//     so either the whole thing lands or nothing does
//
// Run automatically from db/init.js on every server start.

function columnIsNotNull(db, table, column) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  const col = info.find((c) => c.name === column);
  return col ? col.notnull === 1 : false;
}

function indexExists(db, name) {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name = ?").get(name);
}

// Migration 1: telegram_id must become optional so a user can exist with
// only a wallet_address (direct website play, no Telegram at all).
function migrateTelegramIdOptional(db) {
  if (!columnIsNotNull(db, "users", "telegram_id")) return; // already migrated

  console.log("Migrating users table: making telegram_id optional…");

  const wasForeignKeysOn = db.pragma("foreign_keys", { simple: true }) === 1;
  if (wasForeignKeysOn) db.pragma("foreign_keys = OFF");

  const migration = db.transaction(() => {
    db.exec(`
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id TEXT UNIQUE,
        username TEXT,
        coins INTEGER NOT NULL DEFAULT 0,
        referral_code TEXT UNIQUE NOT NULL,
        referred_by INTEGER,
        referral_count INTEGER NOT NULL DEFAULT 0,
        wallet_address TEXT,
        device_fingerprint TEXT,
        last_spin_at TEXT,
        daily_coins_earned INTEGER NOT NULL DEFAULT 0,
        daily_earn_reset_at TEXT,
        is_banned INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (referred_by) REFERENCES users(id),
        CHECK (telegram_id IS NOT NULL OR wallet_address IS NOT NULL)
      );

      INSERT INTO users_new
        SELECT id, telegram_id, username, coins, referral_code, referred_by,
               referral_count, wallet_address, device_fingerprint, last_spin_at,
               daily_coins_earned, daily_earn_reset_at, is_banned, created_at
        FROM users;

      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
    `);
  });

  migration();

  if (wasForeignKeysOn) db.pragma("foreign_keys = ON");

  console.log("✅ users.telegram_id is now optional");
}

// Migration 2: wallet_address needs to be a real identity column, unique
// whenever it's set (but multiple NULLs are fine — most users still won't
// have a linked wallet). A partial unique index is the SQLite way to do
// "unique, but only when not null".
function migrateWalletAddressUniqueIndex(db) {
  const name = "idx_users_wallet_address_unique";
  if (indexExists(db, name)) return;

  console.log("Adding unique index on users.wallet_address…");
  db.exec(`CREATE UNIQUE INDEX ${name} ON users(wallet_address) WHERE wallet_address IS NOT NULL;`);
}

function runMigrations(db) {
  migrateTelegramIdOptional(db);
  migrateWalletAddressUniqueIndex(db);
}

module.exports = { runMigrations };