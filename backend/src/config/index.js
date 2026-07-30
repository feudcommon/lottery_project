require("dotenv").config();

function parseIntEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = parseInt(raw, 10);
  if (Number.isNaN(value)) {
    throw new Error(`${name} must be an integer, got "${raw}"`);
  }
  return value;
}

function parseFloatEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = parseFloat(raw);
  if (Number.isNaN(value)) {
    throw new Error(`${name} must be a number, got "${raw}"`);
  }
  return value;
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const port = parseIntEnv("PORT", 3000);
if (port <= 0 || port > 65535) {
  throw new Error(`PORT must be a valid TCP port, got "${process.env.PORT}"`);
}

module.exports = {
  port,
  nodeEnv: process.env.NODE_ENV || "development",

  jwt: {
    secret: requiredEnv("JWT_SECRET"),
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
  },

  game: {
    ticketPrice: parseIntEnv("TICKET_PRICE", 10),
    maxTicketsPerUserPerDay: parseIntEnv("MAX_TICKETS_PER_USER_PER_DAY", 2),
    totalTicketsPerDay: parseIntEnv("TOTAL_TICKETS_PER_DAY", 50),
    winnerReward: parseIntEnv("WINNER_REWARD", 100),
    platformFee: parseIntEnv("PLATFORM_FEE", 100),
    salesOpenHour: parseIntEnv("SALES_OPEN_HOUR", 9),
    salesCloseHour: parseIntEnv("SALES_CLOSE_HOUR", 15),
    drawHour: parseIntEnv("DRAW_HOUR", 18),
    dailyEarnCap: parseIntEnv("DAILY_EARN_CAP", 100),
    spinCooldownMinutes: parseIntEnv("SPIN_COOLDOWN_MINUTES", 1440),
    spinRewardMin: parseIntEnv("SPIN_REWARD_MIN", 5),
    spinRewardMax: parseIntEnv("SPIN_REWARD_MAX", 20),
    referralBonus: parseIntEnv("REFERRAL_BONUS", 50),
    jackpotContributionRate: parseFloatEnv("JACKPOT_CONTRIBUTION_RATE", 0.5),
  },

  withdrawal: {
    minCoins: parseIntEnv("WITHDRAW_MIN_COINS", 1000),
    minReferrals: parseIntEnv("WITHDRAW_MIN_REFERRALS", 5),
    coinToTokenRate: parseIntEnv("WITHDRAW_COIN_TO_TOKEN_RATE", 100),
  },

  admin: {
    telegramIds: (process.env.ADMIN_TELEGRAM_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    coinsPerUsd: parseIntEnv("COINS_PER_USD", 100),
    minAmountUsdCents: parseIntEnv("STRIPE_MIN_AMOUNT_USD_CENTS", 100),
    maxAmountUsdCents: parseIntEnv("STRIPE_MAX_AMOUNT_USD_CENTS", 50000),
    successUrl: process.env.STRIPE_SUCCESS_URL || "http://localhost:5173/coins/success",
    cancelUrl: process.env.STRIPE_CANCEL_URL || "http://localhost:5173/coins/cancel",
  },
};