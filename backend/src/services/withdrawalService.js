const db = require('../db/connection');
const { AppError } = require('../middleware/errorHandler');
const { sendTokensOnChain } = require('./blockchainService');
const config = require('../config');

// ─── Eligibility check ────────────────────────────────────────────────────────
// Returns everything the frontend needs to render requirements + reasons,
// so the UI never has to hardcode thresholds itself — it just reflects
// whatever this function (and therefore config.withdrawal) says.

function checkEligibility(user) {
  const reasons = [];
  if (user.coins < config.withdrawal.minCoins) {
    reasons.push(`Need ${config.withdrawal.minCoins} coins (you have ${user.coins})`);
  }
  if (user.referral_count < config.withdrawal.minReferrals) {
    reasons.push(`Need ${config.withdrawal.minReferrals} active referrals (you have ${user.referral_count})`);
  }
  return {
    eligible: reasons.length === 0,
    reasons,
    minCoins: config.withdrawal.minCoins,
    minReferrals: config.withdrawal.minReferrals,
    currentCoins: user.coins,
    referralCount: user.referral_count,
  };
}

// ─── Request withdrawal (validates, sends on-chain, records in DB) ─────────────

async function requestWithdrawal(userId, walletAddress, amountCoins) {
  // Validate wallet address format
  if (!walletAddress || !walletAddress.startsWith('0x') || walletAddress.length !== 42) {
    throw new AppError('Invalid wallet address', 400);
  }
  if (!amountCoins || amountCoins <= 0) {
    throw new AppError('Invalid amount', 400);
  }

  // Load user
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) throw new AppError('User not found', 404);
  if (user.is_banned) throw new AppError('Account suspended', 403);

  // Check eligibility
  const { eligible, reasons } = checkEligibility(user);
  if (!eligible) {
    throw new AppError(`Withdraw locked. ${reasons.join('. ')}. Invite more friends to unlock.`, 403);
  }

  // Check balance
  if (amountCoins > user.coins) {
    throw new AppError(`Insufficient balance. You have ${user.coins} coins.`, 400);
  }
  if (amountCoins < config.withdrawal.minCoins) {
    throw new AppError(`Minimum withdrawal is ${config.withdrawal.minCoins} coins.`, 400);
  }

  // Calculate token amount
  const tokenAmount = Math.floor(amountCoins / config.withdrawal.coinToTokenRate);
  if (tokenAmount <= 0) {
    throw new AppError('Amount too small to convert to any tokens.', 400);
  }

  // Send tokens on-chain BEFORE touching the DB
  // If this fails, no coins are deducted and no record is created
  console.log(`Processing withdrawal: ${amountCoins} coins -> ${tokenAmount} LLT to ${walletAddress}`);
  const blockchainResult = await sendTokensOnChain(walletAddress, tokenAmount);

  if (!blockchainResult.success) {
    throw new AppError(`Blockchain error: ${blockchainResult.error}. Your coins have NOT been deducted.`, 500);
  }

  console.log('Blockchain confirmed. Recording in database...');

  // Deduct coins and record withdrawal atomically
  const record = db.transaction(() => {
    const newBalance = user.coins - amountCoins;

    db.prepare('UPDATE users SET coins = ? WHERE id = ?').run(newBalance, userId);

    const insert = db.prepare(`
      INSERT INTO withdrawals (user_id, coins_spent, token_amount, wallet_address, tx_hash, status, processed_at)
      VALUES (?, ?, ?, ?, ?, 'completed', datetime('now'))
    `);
    const result = insert.run(userId, amountCoins, tokenAmount, walletAddress, blockchainResult.transferHash);

    db.prepare(`
      INSERT INTO coin_transactions (user_id, amount, reason, reference_id, balance_after)
      VALUES (?, ?, 'withdrawal', ?, ?)
    `).run(userId, -amountCoins, result.lastInsertRowid, newBalance);

    return {
      withdrawalId: result.lastInsertRowid,
      tokenAmount,
      coinsSpent: amountCoins,
      newBalance,
      status: 'completed',
      txHash: blockchainResult.transferHash,
      explorerUrl: blockchainResult.explorerUrl,
    };
  })();

  return record;
}

// ─── User: get own withdrawal history ─────────────────────────────────────────

function getMyWithdrawals(userId) {
  return db
    .prepare('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY requested_at DESC')
    .all(userId);
}

// ─── Admin: list pending withdrawals ──────────────────────────────────────────

function listPendingWithdrawals() {
  return db.prepare(`
    SELECT w.*, u.username, u.telegram_id
    FROM withdrawals w
    JOIN users u ON u.id = w.user_id
    WHERE w.status = 'pending'
    ORDER BY w.requested_at ASC
  `).all();
}

// ─── Admin: manually mark as sent (fallback if auto blockchain fails) ──────────

function markWithdrawalSent(withdrawalId, txHash) {
  const result = db.prepare(`
    UPDATE withdrawals
    SET status = 'sent', tx_hash = ?, processed_at = datetime('now')
    WHERE id = ? AND status = 'pending'
  `).run(txHash, withdrawalId);

  if (result.changes === 0) {
    throw new AppError('Withdrawal not found or already processed', 404);
  }
  return db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(withdrawalId);
}

// ─── Admin: reject and refund coins ───────────────────────────────────────────

function rejectWithdrawal(withdrawalId, reason) {
  const withdrawal = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(withdrawalId);
  if (!withdrawal || withdrawal.status !== 'pending') {
    throw new AppError('Withdrawal not found or already processed', 404);
  }

  db.transaction(() => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(withdrawal.user_id);
    const newBalance = user.coins + withdrawal.coins_spent;

    db.prepare('UPDATE users SET coins = ? WHERE id = ?').run(newBalance, user.id);
    db.prepare(`
      INSERT INTO coin_transactions (user_id, amount, reason, reference_id, balance_after)
      VALUES (?, ?, 'withdrawal_refund', ?, ?)
    `).run(user.id, withdrawal.coins_spent, withdrawalId, newBalance);
    db.prepare(`
      UPDATE withdrawals SET status = 'rejected', processed_at = datetime('now') WHERE id = ?
    `).run(withdrawalId);
  })();

  return { withdrawalId, status: 'rejected', reason };
}

module.exports = {
  checkEligibility,
  requestWithdrawal,
  getMyWithdrawals,
  listPendingWithdrawals,
  markWithdrawalSent,
  rejectWithdrawal,
};