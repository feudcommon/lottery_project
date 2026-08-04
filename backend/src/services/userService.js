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
 * Credits a referrer's coins + referral_count the moment a referred
 * account is created. Guarded so it can only ever fire once per
 * referred user (checked via a coin_transactions row keyed on the new
 * user's id), same guard style as the old "first play" version — just
 * triggered at signup instead of at first spin/ticket.
 *
 * NOTE: crediting on signup (rather than on first meaningful action)
 * means someone can farm referral bonuses by creating throwaway wallet
 * accounts through their own link without ever playing. If that shows
 * up in practice, the fix is either back to gating on first play, or
 * adding an anti-abuse check here (e.g. per-IP/device signup limits).
 */
function creditReferralOnSignup(referrerId, newUserId) {
  if (!referrerId) return;

  const alreadyCredited = db
    .prepare("SELECT 1 FROM coin_transactions WHERE user_id = ? AND reason = 'referral_bonus_for' AND reference_id = ?")
    .get(referrerId, newUserId);
  if (alreadyCredited) return;

  const referrer = db.prepare("SELECT * FROM users WHERE id = ?").get(referrerId);
  if (!referrer || referrer.is_banned) return;

  const newBalance = referrer.coins + config.game.referralBonus;

  db.prepare("UPDATE users SET coins = ?, referral_count = referral_count + 1 WHERE id = ?").run(
    newBalance,
    referrer.id
  );

  db.prepare(`
    INSERT INTO coin_transactions (user_id, amount, reason, reference_id, balance_after)
    VALUES (?, ?, 'referral_bonus_for', ?, ?)
  `).run(referrer.id, config.game.referralBonus, newUserId, newBalance);
}

/**
 * Finds an existing user by telegram_id, or creates one. Referral credit
 * to the referrer happens immediately on account creation.
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

  if (referredBy) creditReferralOnSignup(referredBy, newUser.id);

  return newUser;
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

  const newUser = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);

  if (referredBy) creditReferralOnSignup(referredBy, newUser.id);

  return newUser;
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
  // Mirrors the exact same three checks as requireAdmin — kept in sync so
  // "can this user reach /admin" and "does this user see the Admin button"
  // never disagree with each other.
  const isEnvTelegramAdmin =
    user.telegram_id && config.admin.telegramIds.includes(String(user.telegram_id));
  const isEnvWalletAdmin =
    user.wallet_address && config.admin.walletAddresses.includes(String(user.wallet_address).toLowerCase());
  const isAdmin = Boolean(isEnvTelegramAdmin || isEnvWalletAdmin || user.is_admin);

  return {
    id: user.id,
    username: user.username,
    coins: user.coins,
    referralCode: user.referral_code,
    referralCount: user.referral_count,
    walletAddress: user.wallet_address,
    hasTelegram: Boolean(user.telegram_id),
    hasWallet: Boolean(user.wallet_address),
    isAdmin,
    withdrawUnlocked:
      user.coins >= config.withdrawal.minCoins && user.referral_count >= config.withdrawal.minReferrals,
  };
}

module.exports = {
  findOrCreateUser,
  findOrCreateUserByWallet,
  linkWalletToUser,
  creditReferralOnSignup,
  // Kept as a no-op alias: referral crediting now happens at signup
  // (creditReferralOnSignup, called from within this file), not at first
  // play. This avoids a hard crash for any other file still importing the
  // old name — it does nothing and is safe to remove once nothing calls it.
  markReferralActiveIfNeeded: () => {},
  getUserById,
  getPublicProfile,
};