// src/db/migrate.js
//
// Schema migrations that can't be expressed as `CREATE TABLE IF NOT EXISTS`
// (SQLite/libSQL has no ALTER COLUMN, so relaxing a NOT NULL constraint
// means rebuilding the table). Everything here is written to be safe to
// run on every boot against a database that may already have real user
// data:
//   - each migration checks whether it's already applied before touching
//     anything
//   - the rebuild runs inside a single transaction with foreign_keys OFF,
//     so either the whole thing lands or nothing does
//
// Run automatically from db/init.js on every server start. All queries
// here go over the network to Turso, so every step is async.

async function columnIsNotNull(db, table, column) {
  const info = await db.prepare(`PRAGMA table_info(${table})`).all();
  const col = info.find((c) => c.name === column);
  return col ? col.notnull === 1 : false;
}

async function indexExists(db, name) {
  const row = await db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name = ?")
    .get(name);
  return !!row;
}

async function hasColumn(db, table, column) {
  const info = await db.prepare(`PRAGMA table_info(${table})`).all();
  return info.some((c) => c.name === column);
}

// Migration 1: telegram_id must become optional so a user can exist with
// only a wallet_address (direct website play, no Telegram at all).
async function migrateTelegramIdOptional(db) {
  if (!(await columnIsNotNull(db, "users", "telegram_id"))) return; // already migrated

  console.log("Migrating users table: making telegram_id optional…");

  const wasForeignKeysOn = (await db.pragma("foreign_keys", { simple: true })) === 1;
  if (wasForeignKeysOn) await db.pragma("foreign_keys = OFF");

  const migration = db.transaction(async (tx) => {
    await tx.exec(`
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

  await migration();

  if (wasForeignKeysOn) await db.pragma("foreign_keys = ON");

  console.log("✅ users.telegram_id is now optional");
}

// Migration 2: wallet_address needs to be a real identity column, unique
// whenever it's set (but multiple NULLs are fine — most users still won't
// have a linked wallet). A partial unique index is the SQLite/libSQL way
// to do "unique, but only when not null".
async function migrateWalletAddressUniqueIndex(db) {
  const name = "idx_users_wallet_address_unique";
  if (await indexExists(db, name)) return;

  console.log("Adding unique index on users.wallet_address…");
  await db.exec(`CREATE UNIQUE INDEX ${name} ON users(wallet_address) WHERE wallet_address IS NOT NULL;`);
}

// Migration 3: is_admin lets admin status be granted in-app (via the admin
// panel's promote/demote buttons) instead of only through the
// ADMIN_TELEGRAM_IDS / ADMIN_WALLET_ADDRESSES env vars. Unlike migration 1,
// adding a plain new column doesn't require a table rebuild.
async function migrateIsAdminColumn(db) {
  if (await hasColumn(db, "users", "is_admin")) return; // already migrated

  console.log("Migrating users table: adding is_admin column…");
  await db.exec(`ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;`);
  console.log("✅ users.is_admin added");
}

// Migration 4: tracks whether a draw's / jackpot's winner has already been
// paid out on-chain by an admin, so "Send winnings" can't be double-clicked
// into sending tokens twice for the same win.
async function migrateWinnerPaidOutColumns(db) {
  if (!(await hasColumn(db, "draws", "winner_paid_out"))) {
    console.log("Migrating draws table: adding winner_paid_out column…");
    await db.exec(`ALTER TABLE draws ADD COLUMN winner_paid_out INTEGER NOT NULL DEFAULT 0;`);
  }
  if (!(await hasColumn(db, "jackpots", "winner_paid_out"))) {
    console.log("Migrating jackpots table: adding winner_paid_out column…");
    await db.exec(`ALTER TABLE jackpots ADD COLUMN winner_paid_out INTEGER NOT NULL DEFAULT 0;`);
  }
}

// Migration 5: in-app notifications, primarily for winners who have no
// Telegram identity (wallet-only players) and therefore can't be reached
// via the bot DM — they'll see this next time they open the site instead.
// Also written for Telegram users so there's one consistent notification
// feed regardless of login method.
async function migrateNotificationsTable(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,            -- 'lottery_win' | 'jackpot_win' (extensible later)
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      reference_id INTEGER,          -- optional FK to draws.id / jackpots.id
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);`);
}

async function runMigrations(db) {
  await migrateTelegramIdOptional(db);
  await migrateWalletAddressUniqueIndex(db);
  await migrateIsAdminColumn(db);
  await migrateWinnerPaidOutColumns(db);
  await migrateNotificationsTable(db);
}

module.exports = { runMigrations };