// src/routes/debugRoutes.js
//
// DEV-ONLY. Lets you delete a test account by wallet address or telegram_id
// so you can re-run signup flows (like referrals) with the same test
// identity instead of it always hitting the "existing user" path.
//
// Refuses to run at all in production, and additionally requires a
// DEBUG_KEY secret so it's never accidentally left reachable.
//
// Usage:
//   DELETE /api/debug/user?wallet=0xabc123...
//   DELETE /api/debug/user?telegramId=123456789
// Header:
//   x-debug-key: <value of DEBUG_KEY env var>

const express = require("express");
const router = express.Router();
const db = require("../db/connection");
const { asyncHandler, AppError } = require("../middleware/errorHandler");

router.use((req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Not found" });
  }
  if (!process.env.DEBUG_KEY || req.headers["x-debug-key"] !== process.env.DEBUG_KEY) {
    return res.status(401).json({ error: "Missing or invalid x-debug-key header" });
  }
  next();
});

// Deletes a user row (and anything referencing it) by wallet address or
// telegram_id, so the identity looks brand-new to findOrCreateUser /
// findOrCreateUserByWallet on the next signup attempt.
router.delete(
  "/user",
  asyncHandler(async (req, res) => {
    const { wallet, telegramId } = req.query;
    if (!wallet && !telegramId) {
      throw new AppError("Provide ?wallet=0x... or ?telegramId=...", 400);
    }

    const user = wallet
      ? db.prepare("SELECT * FROM users WHERE wallet_address = ?").get(wallet)
      : db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(telegramId);

    if (!user) {
      return res.json({ deleted: false, message: "No matching user found" });
    }

    // Clean up rows that reference this user first — SQLite FKs here don't
    // cascade, so deleting the user alone would leave orphaned rows (or
    // fail outright, depending on how foreign_keys is set at the time).
    const tables = [
      "coin_transactions",
      "tickets",
      "withdrawals",
      "onchain_deposits",
      "fiat_deposits",
    ];
    for (const table of tables) {
      db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(user.id);
    }
    // Anyone this user referred should point at nothing rather than a
    // dangling id.
    db.prepare("UPDATE users SET referred_by = NULL WHERE referred_by = ?").run(user.id);

    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);

    res.json({ deleted: true, id: user.id, wallet_address: user.wallet_address, telegram_id: user.telegram_id });
  })
);

module.exports = router;