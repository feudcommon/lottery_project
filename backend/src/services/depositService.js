// src/services/depositService.js
//
// BUGFIX NOTE: this file previously contained frontend React/TypeScript code
// (the useDeposit hook) instead of backend logic. Since app.js requires
// depositRoutes -> depositController -> depositService at boot, the old
// content (`import`/`export`, JSX-flavored TS) threw a SyntaxError under
// CommonJS `require()` and crashed the server before it could start.
// This is the actual backend implementation the controller expects:
// getTreasuryAddress(), creditScaiDeposit(userId, txHash), getMyDeposits(userId).

const { ethers } = require("ethers");
const db = require("../db/connection");
const config = require("../config");
const { AppError } = require("../middleware/errorHandler");

const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS;
const RPC_URL = process.env.RPC_URL;
const SCAI_TO_COINS_RATE = parseInt(process.env.SCAI_TO_COINS_RATE || "100", 10); // 1 SCAI = 100 coins

function getTreasuryAddress() {
  if (!TREASURY_ADDRESS) {
    throw new AppError("Deposits are not configured (missing TREASURY_ADDRESS).", 503);
  }
  return {
    treasuryAddress: TREASURY_ADDRESS,
    scaiToCoinsRate: SCAI_TO_COINS_RATE,
  };
}

// Verifies an on-chain native-SCAI transfer to the treasury address, then
// credits coins. Idempotent on tx_hash (UNIQUE constraint on onchain_deposits).
async function creditScaiDeposit(userId, txHash) {
  if (!TREASURY_ADDRESS || !RPC_URL) {
    throw new AppError("Deposits are not configured.", 503);
  }

  const existing = db.prepare("SELECT * FROM onchain_deposits WHERE tx_hash = ?").get(txHash);
  if (existing) {
    throw new AppError("This transaction has already been credited.", 409);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const tx = await provider.getTransaction(txHash);
  if (!tx) {
    throw new AppError("Transaction not found on chain yet. Try again shortly.", 404);
  }

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt || receipt.status !== 1) {
    throw new AppError("Transaction not confirmed or failed.", 400);
  }

  if (tx.to?.toLowerCase() !== TREASURY_ADDRESS.toLowerCase()) {
    throw new AppError("Transaction was not sent to the treasury address.", 400);
  }

  const amountWei = tx.value;
  const amountScai = parseFloat(ethers.formatEther(amountWei));
  const coinsCredited = Math.floor(amountScai * SCAI_TO_COINS_RATE);

  if (coinsCredited <= 0) {
    throw new AppError("Deposit amount too small to credit any coins.", 400);
  }

  const result = db.transaction(() => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (!user) throw new AppError("User not found", 404);

    const newBalance = user.coins + coinsCredited;
    db.prepare("UPDATE users SET coins = ? WHERE id = ?").run(newBalance, userId);

    const insert = db.prepare(`
      INSERT INTO onchain_deposits (user_id, tx_hash, amount_scai_wei, coins_credited)
      VALUES (?, ?, ?, ?)
    `);
    const inserted = insert.run(userId, txHash, amountWei.toString(), coinsCredited);

    db.prepare(`
      INSERT INTO coin_transactions (user_id, amount, reason, reference_id, balance_after)
      VALUES (?, ?, 'onchain_deposit', ?, ?)
    `).run(userId, coinsCredited, inserted.lastInsertRowid, newBalance);

    return { depositId: inserted.lastInsertRowid, coinsCredited, newBalance };
  })();

  return result;
}

function getMyDeposits(userId) {
  return db
    .prepare("SELECT * FROM onchain_deposits WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId);
}

module.exports = { getTreasuryAddress, creditScaiDeposit, getMyDeposits };