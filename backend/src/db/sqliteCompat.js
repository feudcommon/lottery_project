// src/db/sqliteCompat.js
//
// Adds two better-sqlite3-style convenience methods on top of a raw
// node:sqlite DatabaseSync instance, so the rest of the codebase (which was
// written against better-sqlite3's API) keeps working unchanged:
//
//   db.pragma("journal_mode = WAL")              -> just runs the pragma
//   db.pragma("foreign_keys", { simple: true })  -> returns a scalar value
//   db.transaction(fn)                           -> returns a wrapped fn that
//                                                    runs inside BEGIN/COMMIT,
//                                                    rolling back on throw
//
// node:sqlite's DatabaseSync has neither of these built in — it only has
// prepare()/exec()/close(), which is otherwise API-compatible with
// better-sqlite3 for run()/get()/all().

function attachCompat(db) {
  db.pragma = function pragma(str, opts = {}) {
    // Setter form, e.g. "journal_mode = WAL" or "foreign_keys = ON"
    if (str.includes("=")) {
      db.exec(`PRAGMA ${str}`);
      return;
    }
    // Getter form, e.g. db.pragma("foreign_keys", { simple: true })
    const row = db.prepare(`PRAGMA ${str}`).get();
    if (!row) return undefined;
    if (opts.simple) {
      const firstKey = Object.keys(row)[0];
      return row[firstKey];
    }
    return row;
  };

  // Tracks nesting depth so a transaction() called from inside another
  // transaction() uses SAVEPOINTs instead of a second BEGIN (which SQLite
  // would reject). Mirrors better-sqlite3's nested-transaction behavior.
  let depth = 0;

  db.transaction = function transaction(fn) {
    return function (...args) {
      const isOuter = depth === 0;
      const savepointName = `sp_${depth}`;
      depth++;
      try {
        if (isOuter) db.exec("BEGIN");
        else db.exec(`SAVEPOINT ${savepointName}`);

        const result = fn(...args);

        if (isOuter) db.exec("COMMIT");
        else db.exec(`RELEASE ${savepointName}`);

        return result;
      } catch (err) {
        if (isOuter) db.exec("ROLLBACK");
        else db.exec(`ROLLBACK TO ${savepointName}`);
        throw err;
      } finally {
        depth--;
      }
    };
  };

  return db;
}

module.exports = { attachCompat };
