// src/services/userService.js
//
// Anything that touches "a user's data" lives here, separate from the
// route handlers. This keeps controllers thin (parse request -> call
// service -> send response) and keeps business logic testable/reusable.

const crypto = require("crypto");
const db = require("../db/connection");
const config = require("../config");
const { AppError } = require("../middleware/errorHandler");

function generateReferralCode() {
  return crypto.randomBytes(5).toString("hex"); // e.g. "a1b2c3d4e5"
}

/**
 * Finds an existing user by telegram_id, or creates one.
 * Handles referral attribution on first signup only.
 */
function findOrCreateUser({ telegramId, username, referralCode, deviceFingerprint }) {
  const existing = db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(telegramId);
  if (existing) return existing;

  let referredBy = null;
  if (referralCode) {
    const referrer = db.prepare("SELECT * FROM users WHERE referral_code = ?").get(referralCode);
    if (referrer) referredBy = referrer.id;
  }

  const myReferralCode = generateReferralCode();

  const insert = db.prepare(`
    INSERT INTO users (telegram_id, username, coins, referral_code, referred_by, device_fingerprint, daily_earn_reset_at)
    VALUES (?, ?, 0, ?, ?, ?, datetime('now'))
  `);
  const result = insert.run(telegramId, username, myReferralCode, referredBy, deviceFingerprint || null);

  const newUser = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);

  // Note: we do NOT credit the referral_count or bonus yet. Per the risk
  // management rules in the spec, a referral only "counts" once the
  // referred user actually plays the game (see markReferralActive below).
  // This stops the "fake referral by just clicking a link" exploit.

  return newUser;
}

/**
 * Call this the first time a referred user does something meaningful
 * (e.g. their first spin or first ticket purchase). This is what makes
 * a referral "active" and credits the referrer.
 */
function markReferralActiveIfNeeded(user) {
  if (!user.referred_by) return;

  // Use a flag column trick: we check coin_transactions for whether we've
  // already paid this referral bonus, so it only fires once.
  const alreadyCredited = db
    .prepare("SELECT 1 FROM coin_transactions WHERE user_id = ? AND reason = 'referral_bonus_for' AND reference_id = ?")
    .get(user.referred_by, user.id);

  if (alreadyCredited) return;

  const referrer = db.prepare("SELECT * FROM users WHERE id = ?").get(user.referred_by);
  if (!referrer || referrer.is_banned) return;

  const newBalance = referrer.coins + config.game.referralBonus;

  db.prepare("UPDATE users SET coins = ?, referral_count = referral_count + 1 WHERE id = ?").run(
    newBalance,
    referrer.id
  );

  db.prepare(`
    INSERT INTO coin_transactions (user_id, amount, reason, reference_id, balance_after)
    VALUES (?, ?, 'referral_bonus_for', ?, ?)
  `).run(referrer.id, config.game.referralBonus, user.id, newBalance);
}

/**
 * Finds an existing user by wallet_address, or creates one. Mirrors
 * findOrCreateUser but for players who sign in with just a wallet -
 * no Telegram account involved at all.
 */
function findOrCreateUserByWallet({ walletAddress, referralCode }) {
  const existing = db.prepare("SELECT * FROM users WHERE wallet_address = ?").get(walletAddress);
  if (existing) return existing;

  let referredBy = null;
  if (referralCode) {
    const referrer = db.prepare("SELECT * FROM users WHERE referral_code = ?").get(referralCode);
    if (referrer) referredBy = referrer.id;
  }

  const myReferralCode = generateReferralCode();
  const shortAddress = `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`;

  const insert = db.prepare(`
    INSERT INTO users (wallet_address, username, coins, referral_code, referred_by, daily_earn_reset_at)
    VALUES (?, ?, 0, ?, ?, datetime('now'))
  `);
  const result = insert.run(walletAddress, shortAddress, myReferralCode, referredBy);

  return db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
}

/**
 * Links a wallet address to an already-authenticated (e.g. Telegram) user,
 * so the same account can subsequently log in with either method. Throws
 * if the wallet is already linked to a different account.
 */
function linkWalletToUser(userId, walletAddress) {
  const ownedByOther = db
    .prepare("SELECT id FROM users WHERE wallet_address = ? AND id != ?")
    .get(walletAddress, userId);
  if (ownedByOther) {
    throw new AppError("This wallet is already linked to another account.", 409);
  }

  db.prepare("UPDATE users SET wallet_address = ? WHERE id = ?").run(walletAddress, userId);
  return db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
}

function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

function getPublicProfile(user) {
  return {
    id: user.id,
    username: user.username,
    coins: user.coins,
    referralCode: user.referral_code,
    referralCount: user.referral_count,
    walletAddress: user.wallet_address,
    hasTelegram: Boolean(user.telegram_id),
    hasWallet: Boolean(user.wallet_address),
    withdrawUnlocked:
      user.coins >= config.withdrawal.minCoins && user.referral_count >= config.withdrawal.minReferrals,
  };
}

module.exports = {
  findOrCreateUser,
  findOrCreateUserByWallet,
  linkWalletToUser,
  markReferralActiveIfNeeded,
  getUserById,
  getPublicProfile,
};