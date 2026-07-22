// src/utils/walletAuth.js
//
// "Connect wallet and play" needs the same guarantee Telegram login has:
// proof the person actually controls the address they claim, not just an
// address they typed in or read off someone else's screen. The standard
// way to do that for wallets is a nonce-signature challenge:
//
// 1. Client asks the backend for a nonce for address X (getNonceMessage).
// 2. Backend generates a random nonce, stores it against X, and hands back
//    a human-readable message containing it.
// 3. The wallet signs that exact message (MetaMask/WalletConnect show it
//    to the user as "Signature request").
// 4. Client posts { address, signature } back.
// 5. Backend recomputes the same message from the stored nonce, recovers
//    the signer address from the signature (ethers.verifyMessage), and
//    checks it matches X.
//
// Because ECDSA signatures can't be forged without the private key, a
// valid signature over our nonce is proof of ownership. The nonce is
// single-use and short-lived so a captured signature can't be replayed
// later or against a different login.

const crypto = require("crypto");
const { ethers } = require("ethers");
const db = require("../db/connection");
const { AppError } = require("../middleware/errorHandler");

const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function normalizeAddress(address) {
  try {
    return ethers.getAddress(String(address)).toLowerCase();
  } catch {
    throw new AppError("Invalid wallet address", 400);
  }
}

function buildMessage(address, nonce) {
  return (
    `SCAI Lucky Loop wants you to sign in with your wallet.\n\n` +
    `This request will not trigger a blockchain transaction or cost any gas.\n\n` +
    `Address: ${address}\n` +
    `Nonce: ${nonce}`
  );
}

/** Issues (or replaces) a one-time login nonce for an address. */
function issueNonce(rawAddress) {
  const address = normalizeAddress(rawAddress);
  const nonce = crypto.randomBytes(16).toString("hex");

  db.prepare(
    `INSERT INTO wallet_login_nonces (wallet_address, nonce, created_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(wallet_address) DO UPDATE SET nonce = excluded.nonce, created_at = excluded.created_at`
  ).run(address, nonce);

  return { address, message: buildMessage(address, nonce) };
}

/**
 * Verifies a signed nonce and consumes it (single-use). Returns the
 * checked, normalized address on success; throws AppError on any failure.
 */
function verifyAndConsumeNonce(rawAddress, signature) {
  const address = normalizeAddress(rawAddress);

  if (!signature || typeof signature !== "string") {
    throw new AppError("Missing signature", 400);
  }

  const row = db.prepare("SELECT * FROM wallet_login_nonces WHERE wallet_address = ?").get(address);
  if (!row) {
    throw new AppError("No login request found for this address. Please try again.", 400);
  }

  const ageMs = Date.now() - new Date(row.created_at.replace(" ", "T") + "Z").getTime();
  if (ageMs > NONCE_TTL_MS) {
    db.prepare("DELETE FROM wallet_login_nonces WHERE wallet_address = ?").run(address);
    throw new AppError("Login request expired. Please try again.", 400);
  }

  const message = buildMessage(address, row.nonce);

  let recovered;
  try {
    recovered = ethers.verifyMessage(message, signature).toLowerCase();
  } catch {
    throw new AppError("Invalid signature", 401);
  }

  // Nonce is single-use regardless of outcome, so a captured/failed
  // signature can't be retried against the same challenge.
  db.prepare("DELETE FROM wallet_login_nonces WHERE wallet_address = ?").run(address);

  if (recovered !== address) {
    throw new AppError("Signature does not match the provided address", 401);
  }

  return address;
}

module.exports = { normalizeAddress, issueNonce, verifyAndConsumeNonce };