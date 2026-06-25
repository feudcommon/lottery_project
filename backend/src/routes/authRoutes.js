// src/routes/authRoutes.js

const express = require("express");
const router = express.Router();

const { telegramLogin } = require("../controllers/authController");
const { validate, telegramLoginSchema } = require("../middleware/validate");
const { loginLimiter } = require("../middleware/rateLimiter");

// POST /api/auth/telegram
router.post("/telegram", loginLimiter, validate(telegramLoginSchema), telegramLogin);

module.exports = router;
