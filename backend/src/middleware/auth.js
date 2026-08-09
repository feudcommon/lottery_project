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

async function requireAuth(req, res, next) {
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
  let user;
  try {
    user = await db.prepare("SELECT * FROM users WHERE id = ?").get(payload.sub);
  } catch (err) {
    return next(err);
  }
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
// Admin status can come from any of three places:
//   - the ADMIN_TELEGRAM_IDS env var (bootstrap access, no DB write needed)
//   - the ADMIN_WALLET_ADDRESSES env var (same, for wallet-only accounts)
//   - the is_admin DB column, which lets an existing admin grant access to
//     someone else in-app (see adminController promote/demote) without
//     ever touching env vars or redeploying.
function requireAdmin(req, res, next) {
  const config = require("../config");
  if (!req.user) {
    return res.status(403).json({ error: "Admin access required" });
  }

  const isEnvTelegramAdmin =
    req.user.telegram_id && config.admin.telegramIds.includes(String(req.user.telegram_id));

  const isEnvWalletAdmin =
    req.user.wallet_address &&
    config.admin.walletAddresses.includes(String(req.user.wallet_address).toLowerCase());

  const isDbAdmin = Boolean(req.user.is_admin);

  if (!isEnvTelegramAdmin && !isEnvWalletAdmin && !isDbAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
}

module.exports = { requireAuth, requireAdmin };