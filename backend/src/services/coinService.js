// src/services/coinService.js
//
// Handles the "free coin earning" side (daily spin). This is the #1 abuse
// target in any free-to-play economy, so two protections live here:
//   1. A cooldown — can't spin again until N minutes have passed.
//   2. A daily earn CAP — even with legitimate spins/tasks, total free
//      coins per day is capped, so no exploit (bug, multi-account, script)
//      can mint unlimited coins per account per day.

const crypto = require("crypto");
const db = require("../db/connection");
const config = require("../config");
const { AppError } = require("../middleware/errorHandler");
const { markReferralActiveIfNeeded } = require("./userService");

const spinTransaction = db.transaction((userId) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) throw new AppError("User not found", 404);
  if (user.is_banned) throw new AppError("Account suspended", 403);

  // Reset the daily counter if a new day has started since last reset
  const lastReset = user.daily_earn_reset_at ? new Date(user.daily_earn_reset_at) : null;
  const now = new Date();
  const isNewDay = !lastReset || lastReset.toDateString() !== now.toDateString();

  let dailyEarned = user.daily_coins_earned;
  if (isNewDay) {
    dailyEarned = 0;
    db.prepare("UPDATE users SET daily_coins_earned = 0, daily_earn_reset_at = datetime('now') WHERE id = ?").run(
      userId
    );
  }

  // Cooldown check
  if (user.last_spin_at) {
    const elapsedMinutes = (now - new Date(user.last_spin_at)) / 60000;
    if (elapsedMinutes < config.game.spinCooldownMinutes) {
  const remainingMinutes = Math.ceil(config.game.spinCooldownMinutes - elapsedMinutes);
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;

  const remainingLabel = hours > 0
    ? `${hours}h ${minutes}m`
    : `${minutes} minute(s)`;

  throw new AppError(`Next spin available in ${remainingLabel}.`, 429);
}
  }

  // Daily cap check
  if (dailyEarned >= config.game.dailyEarnCap) {
    throw new AppError("Daily free-coin limit reached. Come back tomorrow!", 429);
  }

  // Cryptographically secure random reward in [min, max]
  const { spinRewardMin: min, spinRewardMax: max } = config.game;
  const reward = min + crypto.randomInt(max - min + 1);
  const cappedReward = Math.min(reward, config.game.dailyEarnCap - dailyEarned);

  const newBalance = user.coins + cappedReward;

  db.prepare(`
    UPDATE users
    SET coins = ?, last_spin_at = datetime('now'), daily_coins_earned = daily_coins_earned + ?
    WHERE id = ?
  `).run(newBalance, cappedReward, userId);

  db.prepare(`
    INSERT INTO coin_transactions (user_id, amount, reason, balance_after)
    VALUES (?, ?, 'spin', ?)
  `).run(userId, cappedReward, newBalance);

  return { reward: cappedReward, newBalance };
});

function spin(userId) {
  const result = spinTransaction(userId);
  try {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    markReferralActiveIfNeeded(user);
  } catch (e) {
    console.error("Referral activation failed (non-fatal):", e);
  }
  return result;
}

function getTransactionHistory(userId, limit = 50) {
  return db
    .prepare("SELECT * FROM coin_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(userId, limit);
}

module.exports = { spin, getTransactionHistory };
