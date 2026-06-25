// src/db/connection.js
//
// Single shared database connection. better-sqlite3 connections are
// synchronous and safe to share across the app (no connection pool needed).

const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "..", "data", "lucky_loop.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

module.exports = db;
