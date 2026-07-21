// src/routes/authRoutes.js

const express = require("express");
const router = express.Router();

const { telegramLogin, browserTelegramLogin } = require("../controllers/authController");
const { validate, telegramLoginSchema, browserTelegramLoginSchema } = require("../middleware/validate");
const { loginLimiter } = require("../middleware/rateLimiter");

// POST /api/auth/telegram
router.post("/telegram", loginLimiter, validate(telegramLoginSchema), telegramLogin);
// Telegram's Login Widget provides a signed payload for browser visitors.
router.post("/telegram-browser", loginLimiter, validate(browserTelegramLoginSchema), browserTelegramLogin);

module.exports = router;
