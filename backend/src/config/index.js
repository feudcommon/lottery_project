// src/config/index.js
//
// Every "magic number" in the game (ticket price, reward, hours) lives here,
// read from environment variables with sane fallbacks. This means you can
// change the entire game economy by editing .env — no code changes, no redeploy
// of logic, just a restart.

require("dotenv").config();

module.exports = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
  },

  game: {
    ticketPrice: parseInt(process.env.TICKET_PRICE || "10", 10),
    maxTicketsPerUserPerDay: parseInt(process.env.MAX_TICKETS_PER_USER_PER_DAY || "2", 10),
    totalTicketsPerDay: parseInt(process.env.TOTAL_TICKETS_PER_DAY || "50", 10),
    winnerReward: parseInt(process.env.WINNER_REWARD || "100", 10),
    platformFee: parseInt(process.env.PLATFORM_FEE || "100", 10),
    salesOpenHour: parseInt(process.env.SALES_OPEN_HOUR || "9", 10),
    salesCloseHour: parseInt(process.env.SALES_CLOSE_HOUR || "15", 10),
    drawHour: parseInt(process.env.DRAW_HOUR || "18", 10),
    // Anti-abuse: max free coins a user can earn per day from spins/tasks
    dailyEarnCap: parseInt(process.env.DAILY_EARN_CAP || "100", 10),
    spinCooldownMinutes: parseInt(process.env.SPIN_COOLDOWN_MINUTES || "1440", 10), // 24h
    spinRewardMin: parseInt(process.env.SPIN_REWARD_MIN || "5", 10),
    spinRewardMax: parseInt(process.env.SPIN_REWARD_MAX || "20", 10),
    referralBonus: parseInt(process.env.REFERRAL_BONUS || "50", 10),
    jackpotContributionRate: parseFloat(process.env.JACKPOT_CONTRIBUTION_RATE || "0.5"), // fraction of platformFee that goes to jackpot per ticket
  },

  withdrawal: {
    minCoins: parseInt(process.env.WITHDRAW_MIN_COINS || "1000", 10),
    minReferrals: parseInt(process.env.WITHDRAW_MIN_REFERRALS || "5", 10),
    coinToTokenRate: parseInt(process.env.WITHDRAW_COIN_TO_TOKEN_RATE || "100", 10), // 100 coins = 1 token
  },

  admin: {
    telegramIds: (process.env.ADMIN_TELEGRAM_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },

  // NEW: Stripe fiat purchase settings.
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    // How many coins 1 USD buys. Keep this as the single source of truth so
    // the frontend never has to hardcode pricing — it reads it from
    // GET /api/stripe/config instead.
    coinsPerUsd: parseInt(process.env.COINS_PER_USD || "100", 10),
    minAmountUsdCents: parseInt(process.env.STRIPE_MIN_AMOUNT_USD_CENTS || "100", 10), // $1 floor (Stripe's own card minimum)
    maxAmountUsdCents: parseInt(process.env.STRIPE_MAX_AMOUNT_USD_CENTS || "50000", 10), // $500 ceiling, adjust as needed
    // Where Stripe Checkout redirects after payment. The frontend route
    // handles crediting confirmation client-side by polling balance;
    // the source of truth is always the webhook, not this redirect.
    successUrl: process.env.STRIPE_SUCCESS_URL || "http://localhost:5173/coins/success",
    cancelUrl: process.env.STRIPE_CANCEL_URL || "http://localhost:5173/coins/cancel",
  },
};