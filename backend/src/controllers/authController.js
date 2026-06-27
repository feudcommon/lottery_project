// src/controllers/authController.js

const { verifyTelegramWebAppData } = require("../utils/telegramAuth");
const { signUserToken } = require("../utils/jwt");
const { findOrCreateUser, getPublicProfile } = require("../services/userService");
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

module.exports = { telegramLogin };
