// src/middleware/auth.js
//
// MIDDLEWARE EXPLAINED:
// Express middleware is just a function that runs BEFORE your route handler.
// It receives (req, res, next). Calling next() passes control to the next
// middleware/route. NOT calling next() (e.g. calling res.json() instead)
// stops the request right there.
//
// requireAuth: blocks the request entirely if there's no valid token.
// Use this on every route that touches money/coins/identity (buy ticket,
// withdraw, view own profile).

const { verifyToken } = require("../utils/jwt");
const db = require("../db/connection");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Re-fetch the user from DB on every request rather than trusting the
  // token payload blindly — this catches bans, coin changes, etc. in real time.
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.sub);
  if (!user) {
    return res.status(401).json({ error: "User no longer exists" });
  }
  if (user.is_banned) {
    return res.status(403).json({ error: "Account suspended" });
  }

  req.user = user; // <-- now every downstream handler can read req.user
  next();
}

// requireAdmin: stack this AFTER requireAuth on admin-only routes.
function requireAdmin(req, res, next) {
  const config = require("../config");
  if (!req.user || !config.admin.telegramIds.includes(String(req.user.telegram_id))) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
