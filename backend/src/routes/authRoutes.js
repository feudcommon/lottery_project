// src/routes/authRoutes.js

const express = require("express");
const router = express.Router();

const {
  telegramLogin,
  browserTelegramLogin,
  getWalletNonce,
  walletLogin,
  linkWallet,
} = require("../controllers/authController");
const {
  validate,
  telegramLoginSchema,
  browserTelegramLoginSchema,
} = require("../middleware/validate");
const { loginLimiter } = require("../middleware/rateLimiter");
const { requireAuth } = require("../middleware/auth");

// POST /api/auth/telegram
router.post("/telegram", loginLimiter, validate(telegramLoginSchema), telegramLogin);
// Telegram's Login Widget provides a signed payload for browser visitors.
router.post("/telegram-browser", loginLimiter, validate(browserTelegramLoginSchema), browserTelegramLogin);

// GET /api/auth/wallet/nonce?address=0x... — issues the message to sign
router.get("/wallet/nonce", loginLimiter, getWalletNonce);
// POST /api/auth/wallet — wallet-only login/signup, no Telegram required
router.post("/wallet", loginLimiter, walletLogin);
// POST /api/auth/wallet/link — attach a wallet to the current logged-in account
router.post("/wallet/link", loginLimiter, requireAuth, linkWallet);

module.exports = router;