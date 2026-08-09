// src/db/connection.js
//
// Single shared Turso (libSQL) client. This replaces the old node:sqlite
// (DatabaseSync) connection, which wrote to a local file on the
// container's disk — fine for durability on a machine you control, but
// on most host platforms (Render, Shiper, etc.) that disk is ephemeral:
// every redeploy or free-tier spin-down wipes it, taking all app data
// (including referral relationships) with it. Turso stores the data
// remotely, outside the app container, so it survives restarts,
// redeploys, and even switching hosts entirely.
//
// IMPORTANT — this connection is now ASYNC. node:sqlite / better-sqlite3
// were synchronous, which is why the rest of the codebase originally
// called `db.prepare(sql).get(...)` and got a value back immediately.
// A remote database can't do that — every query is a network round trip.
// This module keeps the same *shape* of API (`db.prepare(sql).get/all/run`,
// `db.transaction(fn)`) so the rest of the code stays readable, but every
// one of those calls now returns a Promise and must be awaited.
// src/db/connection.js
//
// ... (existing comments) ...
require("dotenv").config();
const { createClient } = require("@libsql/client");

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  throw new Error(
    "TURSO_DATABASE_URL is required. Create a database with `turso db create`, " +
      "then set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in your environment " +
      "(see backend/.env.example).",
  );
}

const client = createClient({ url, authToken });

// Converts a libSQL Row (array-and-object-hybrid) into a plain object, and
// normalizes bigints (libSQL returns some values, like lastInsertRowid, as
// BigInt) into regular numbers, since nothing in this codebase deals in
// bigints and JSON.stringify() can't serialize them.
function rowToObject(row, columns) {
  const obj = {};
  for (let i = 0; i < columns.length; i++) {
    const value = row[i];
    obj[columns[i]] = typeof value === "bigint" ? Number(value) : value;
  }
  return obj;
}

function runResult(rs) {
  return {
    lastInsertRowid:
      rs.lastInsertRowid !== undefined && rs.lastInsertRowid !== null
        ? Number(rs.lastInsertRowid)
        : undefined,
    changes: rs.rowsAffected,
  };
}

// Wraps either the top-level client or an open interactive transaction so
// `.prepare(sql).get/all/run(...)` works the same way against either one.
function makePrepare(executor) {
  return function prepare(sql) {
    return {
      async get(...args) {
        const rs = await executor.execute({ sql, args });
        return rs.rows[0] ? rowToObject(rs.rows[0], rs.columns) : undefined;
      },
      async all(...args) {
        const rs = await executor.execute({ sql, args });
        return rs.rows.map((row) => rowToObject(row, rs.columns));
      },
      async run(...args) {
        const rs = await executor.execute({ sql, args });
        return runResult(rs);
      },
    };
  };
}

const db = {
  prepare: makePrepare(client),

  // For raw multi-statement DDL/scripts (schema setup, migrations).
  async exec(sql) {
    await client.executeMultiple(sql);
  },

  // Mirrors the old sync `db.pragma(...)` helper:
  //   db.pragma("foreign_keys = ON")                  -> runs it
  //   db.pragma("foreign_keys", { simple: true })      -> returns a scalar
  async pragma(str, opts = {}) {
    if (str.includes("=")) {
      await client.execute(`PRAGMA ${str}`);
      return undefined;
    }
    const rs = await client.execute(`PRAGMA ${str}`);
    const row = rs.rows[0] ? rowToObject(rs.rows[0], rs.columns) : undefined;
    if (!row) return undefined;
    if (opts.simple) {
      const firstKey = Object.keys(row)[0];
      return row[firstKey];
    }
    return row;
  },

  // Runs `fn` inside a single interactive transaction. `fn` receives a
  // transaction-scoped db handle (same prepare/exec/pragma shape) as its
  // FIRST argument, followed by whatever arguments the wrapped function is
  // called with — every function that used to be wrapped in
  // `db.transaction((a, b) => {...})` is now `db.transaction(async (tx, a, b) => {...})`,
  // and every `db.prepare(...)` inside it must be `tx.prepare(...)` so the
  // statement actually runs inside the transaction instead of as its own
  // separate auto-committed request.
  transaction(fn) {
    return async function (...args) {
      const tx = await client.transaction("write");
      const txDb = {
        prepare: makePrepare(tx),
        async exec(sql) {
          await tx.executeMultiple(sql);
        },
      };
      try {
        const result = await fn(txDb, ...args);
        await tx.commit();
        return result;
      } catch (err) {
        try {
          await tx.rollback();
        } catch {
          // already closed/rolled back — ignore
        }
        throw err;
      } finally {
        tx.close();
      }
    };
  },

  close() {
    client.close();
  },
};

module.exports = db;