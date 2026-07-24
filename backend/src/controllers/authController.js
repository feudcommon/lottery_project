// src/controllers/authController.js

const { verifyTelegramWebAppData, verifyTelegramLoginWidgetData } = require("../utils/telegramAuth");
const { issueNonce, verifyAndConsumeNonce } = require("../utils/walletAuth");
const { signUserToken } = require("../utils/jwt");
const {
  findOrCreateUser,
  findOrCreateUserByWallet,
  linkWalletToUser,
  getPublicProfile,
} = require("../services/userService");
const { asyncHandler, AppError } = require("../middleware/errorHandler");

const telegramLogin = asyncHandler(async (req, res) => {
  const { initData, referralCode } = req.body;
  console.log('Auth attempt, initData length:', initData?.length);
  console.log('Verification result:', JSON.stringify(verifyTelegramWebAppData(initData)));

  const verification = verifyTelegramWebAppData(initData);
  if (!verification.valid) {
    throw new AppError(verification.error || "Telegram verification failed", 401);
  }

  const { telegramId, username } = verification.data;

  // Simple device/browser fingerprint signal for anti-multi-account checks.
  // Not foolproof on its own, but combined with telegram_id uniqueness and
  // referral-activity requirements, it raises the cost of farming accounts.
  const deviceFingerprint = req.headers["user-agent"] || null;

  const user = findOrCreateUser({ telegramId, username, referralCode, deviceFingerprint });
  const token = signUserToken(user);

  res.json({
    token,
    user: getPublicProfile(user),
  });
});

const browserTelegramLogin = asyncHandler(async (req, res) => {
  const { referralCode, ...telegramPayload } = req.body;
  const verification = verifyTelegramLoginWidgetData(telegramPayload);
  if (!verification.valid) throw new AppError(verification.error || "Telegram login failed", 401);
  const user = findOrCreateUser({
    ...verification.data,
    referralCode,
    deviceFingerprint: req.headers["user-agent"] || null,
  });
  res.json({ token: signUserToken(user), user: getPublicProfile(user) });
});

// GET /api/auth/wallet/nonce?address=0x...
// Issues a fresh, single-use message for the wallet to sign. No login
// happens here yet — this just hands back what needs to be signed.
const getWalletNonce = asyncHandler(async (req, res) => {
  const { address } = req.query;
  if (!address) throw new AppError("address is required", 400);
  const { message } = issueNonce(address);
  res.json({ message });
});

// POST /api/auth/wallet  { address, signature, referralCode? }
// Wallet-only login/signup — proves address ownership via signature, then
// finds or creates an account for that wallet. No Telegram account needed.
const walletLogin = asyncHandler(async (req, res) => {
  const { address, signature, referralCode } = req.body;
  if (!address || !signature) {
    throw new AppError("address and signature are required", 400);
  }

  const verifiedAddress = verifyAndConsumeNonce(address, signature);

  const user = findOrCreateUserByWallet({
    walletAddress: verifiedAddress,
    referralCode,
  });

  const token = signUserToken(user);
  res.json({ token, user: getPublicProfile(user) });
});

// POST /api/auth/wallet/link  { address, signature }
// Attaches a verified wallet to the CURRENTLY logged-in account.
// Must run after requireAuth (see routes) so req.user is set.
const linkWallet = asyncHandler(async (req, res) => {
  const { address, signature } = req.body;
  if (!address || !signature) {
    throw new AppError("address and signature are required", 400);
  }

  const verifiedAddress = verifyAndConsumeNonce(address, signature);
  const user = linkWalletToUser(req.user.id, verifiedAddress);
  res.json({ user: getPublicProfile(user) });
});

module.exports = {
  telegramLogin,
  browserTelegramLogin,
  getWalletNonce,
  walletLogin,
  linkWallet,
};