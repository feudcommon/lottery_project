// src/db/connection.js
//
// Single shared database connection. node:sqlite (DatabaseSync) connections
// are synchronous and safe to share across the app (no connection pool
// needed) — same reasoning as better-sqlite3, which this replaced to avoid
// native-module compile issues on resource-constrained hosts.
const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");
const { attachCompat } = require("./sqliteCompat");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "..", "data", "lucky_loop.db");

// Create directory if it doesn't exist
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log(`Created database directory: ${dbDir}`);
}

const db = attachCompat(new DatabaseSync(DB_PATH));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

module.exports = db;
