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
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
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
  const record = await db.transaction(async (tx) => {
    const newBalance = user.coins - amountCoins;

    await tx.prepare('UPDATE users SET coins = ? WHERE id = ?').run(newBalance, userId);

    const insert = tx.prepare(`
      INSERT INTO withdrawals (user_id, coins_spent, token_amount, wallet_address, tx_hash, status, processed_at)
      VALUES (?, ?, ?, ?, ?, 'completed', datetime('now'))
    `);
    const result = await insert.run(userId, amountCoins, tokenAmount, walletAddress, blockchainResult.transferHash);

    await tx.prepare(`
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

async function getMyWithdrawals(userId) {
  return db
    .prepare('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY requested_at DESC')
    .all(userId);
}

// ─── Admin: list pending withdrawals ──────────────────────────────────────────

async function listPendingWithdrawals() {
  return db.prepare(`
    SELECT w.*, u.username, u.telegram_id
    FROM withdrawals w
    JOIN users u ON u.id = w.user_id
    WHERE w.status = 'pending'
    ORDER BY w.requested_at ASC
  `).all();
}

// ─── Admin: manually mark as sent (fallback if auto blockchain fails) ──────────

async function markWithdrawalSent(withdrawalId, txHash) {
  const result = await db.prepare(`
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

async function rejectWithdrawal(withdrawalId, reason) {
  const withdrawal = await db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(withdrawalId);
  if (!withdrawal || withdrawal.status !== 'pending') {
    throw new AppError('Withdrawal not found or already processed', 404);
  }

  await db.transaction(async (tx) => {
    const user = await tx.prepare('SELECT * FROM users WHERE id = ?').get(withdrawal.user_id);
    const newBalance = user.coins + withdrawal.coins_spent;

    await tx.prepare('UPDATE users SET coins = ? WHERE id = ?').run(newBalance, user.id);
    await tx.prepare(`
      INSERT INTO coin_transactions (user_id, amount, reason, reference_id, balance_after)
      VALUES (?, ?, 'withdrawal_refund', ?, ?)
    `).run(user.id, withdrawal.coins_spent, withdrawalId, newBalance);
    await tx.prepare(`
      UPDATE withdrawals SET status = 'rejected', processed_at = datetime('now') WHERE id = ?
    `).run(withdrawalId);
  })();

  return { withdrawalId, status: 'rejected', reason };
}

// ─── Admin: send a draw winner's prize on-chain directly ──────────────────────
// Unlike requestWithdrawal, this is admin-initiated and specifically for a
// draw's already-credited winnings — it skips the normal eligibility gate
// (minCoins/minReferrals) since it's not a general withdrawal, just getting
// the winner their prize without waiting on them to request it themselves.
// The coin deduction + on-chain send is for exactly the draw's reward_amount,
// so it's a no-op on the rest of their balance/eligibility.

async function payoutDrawWinner(drawDate) {
  const draw = await db.prepare('SELECT * FROM draws WHERE draw_date = ?').get(drawDate);
  if (!draw) throw new AppError('No draw found for that date', 404);
  if (draw.status !== 'drawn' || !draw.winner_user_id) {
    throw new AppError('This draw has no winner yet — run the draw first.', 400);
  }
  if (draw.winner_paid_out) {
    throw new AppError('This draw\'s winner has already been paid out.', 409);
  }

  const winner = await db.prepare('SELECT * FROM users WHERE id = ?').get(draw.winner_user_id);
  if (!winner) throw new AppError('Winner account no longer exists', 404);
  if (!winner.wallet_address) {
    throw new AppError('Winner has no linked wallet address — ask them to connect one first.', 400);
  }

  const amountCoins = draw.reward_amount;
  if (winner.coins < amountCoins) {
    throw new AppError(
      `Winner only has ${winner.coins} coins left (won ${amountCoins}) — they may have already spent some.`,
      400
    );
  }

  const tokenAmount = Math.floor(amountCoins / config.withdrawal.coinToTokenRate);
  if (tokenAmount <= 0) {
    throw new AppError('Reward amount too small to convert to any tokens.', 400);
  }

  console.log(`[Payout] Sending draw ${drawDate} prize: ${amountCoins} coins -> ${tokenAmount} LLT to ${winner.wallet_address}`);
  const blockchainResult = await sendTokensOnChain(winner.wallet_address, tokenAmount);
  if (!blockchainResult.success) {
    throw new AppError(`Blockchain error: ${blockchainResult.error}. Nothing was deducted.`, 500);
  }

  const record = await db.transaction(async (tx) => {
    const newBalance = winner.coins - amountCoins;
    await tx.prepare('UPDATE users SET coins = ? WHERE id = ?').run(newBalance, winner.id);

    const insert = tx.prepare(`
      INSERT INTO withdrawals (user_id, coins_spent, token_amount, wallet_address, tx_hash, status, processed_at)
      VALUES (?, ?, ?, ?, ?, 'completed', datetime('now'))
    `);
    const result = await insert.run(winner.id, amountCoins, tokenAmount, winner.wallet_address, blockchainResult.transferHash);

    await tx.prepare(`
      INSERT INTO coin_transactions (user_id, amount, reason, reference_id, balance_after)
      VALUES (?, ?, 'draw_prize_payout', ?, ?)
    `).run(winner.id, -amountCoins, result.lastInsertRowid, newBalance);

    await tx.prepare('UPDATE draws SET winner_paid_out = 1 WHERE id = ?').run(draw.id);

    return {
      withdrawalId: result.lastInsertRowid,
      winnerUserId: winner.id,
      tokenAmount,
      coinsSpent: amountCoins,
      newBalance,
      txHash: blockchainResult.transferHash,
      explorerUrl: blockchainResult.explorerUrl,
    };
  })();

  return record;
}

// ─── Admin: send a jackpot winner's prize on-chain directly ───────────────────
// Same idea as payoutDrawWinner, for the weekly jackpot instead.

async function payoutJackpotWinner(weekStart) {
  const jackpot = await db.prepare('SELECT * FROM jackpots WHERE week_start = ?').get(weekStart);
  if (!jackpot) throw new AppError('No jackpot found for that week', 404);
  if (jackpot.status !== 'drawn' || !jackpot.winner_user_id) {
    throw new AppError('This jackpot has no winner yet — run the jackpot draw first.', 400);
  }
  if (jackpot.winner_paid_out) {
    throw new AppError('This jackpot\'s winner has already been paid out.', 409);
  }

  const winner = await db.prepare('SELECT * FROM users WHERE id = ?').get(jackpot.winner_user_id);
  if (!winner) throw new AppError('Winner account no longer exists', 404);
  if (!winner.wallet_address) {
    throw new AppError('Winner has no linked wallet address — ask them to connect one first.', 400);
  }

  const amountCoins = jackpot.pool_amount;
  if (winner.coins < amountCoins) {
    throw new AppError(
      `Winner only has ${winner.coins} coins left (won ${amountCoins}) — they may have already spent some.`,
      400
    );
  }

  const tokenAmount = Math.floor(amountCoins / config.withdrawal.coinToTokenRate);
  if (tokenAmount <= 0) {
    throw new AppError('Jackpot amount too small to convert to any tokens.', 400);
  }

  console.log(`[Payout] Sending jackpot ${weekStart} prize: ${amountCoins} coins -> ${tokenAmount} LLT to ${winner.wallet_address}`);
  const blockchainResult = await sendTokensOnChain(winner.wallet_address, tokenAmount);
  if (!blockchainResult.success) {
    throw new AppError(`Blockchain error: ${blockchainResult.error}. Nothing was deducted.`, 500);
  }

  const record = await db.transaction(async (tx) => {
    const newBalance = winner.coins - amountCoins;
    await tx.prepare('UPDATE users SET coins = ? WHERE id = ?').run(newBalance, winner.id);

    const insert = tx.prepare(`
      INSERT INTO withdrawals (user_id, coins_spent, token_amount, wallet_address, tx_hash, status, processed_at)
      VALUES (?, ?, ?, ?, ?, 'completed', datetime('now'))
    `);
    const result = await insert.run(winner.id, amountCoins, tokenAmount, winner.wallet_address, blockchainResult.transferHash);

    await tx.prepare(`
      INSERT INTO coin_transactions (user_id, amount, reason, reference_id, balance_after)
      VALUES (?, ?, 'jackpot_prize_payout', ?, ?)
    `).run(winner.id, -amountCoins, result.lastInsertRowid, newBalance);

    await tx.prepare('UPDATE jackpots SET winner_paid_out = 1 WHERE id = ?').run(jackpot.id);

    return {
      withdrawalId: result.lastInsertRowid,
      winnerUserId: winner.id,
      tokenAmount,
      coinsSpent: amountCoins,
      newBalance,
      txHash: blockchainResult.transferHash,
      explorerUrl: blockchainResult.explorerUrl,
    };
  })();

  return record;
}

module.exports = {
  checkEligibility,
  requestWithdrawal,
  getMyWithdrawals,
  listPendingWithdrawals,
  markWithdrawalSent,
  rejectWithdrawal,
  payoutDrawWinner,
  payoutJackpotWinner,
};