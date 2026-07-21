const express = require("express");
const db = require("../db/connection");
const config = require("../config");
const lotteryService = require("../services/lotteryService");
const jackpotService = require("../services/jackpotService");
const { globalLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

router.get("/stats", globalLimiter, (req, res) => {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: process.env.CRON_TIMEZONE || "UTC" });
  const draw = lotteryService.getDraw(today);
  const jackpot = jackpotService.getCurrentJackpotStatus();
  const playerCount = db.prepare("SELECT COUNT(*) AS count FROM users WHERE is_banned = 0").get().count;
  const winnerCount = db.prepare("SELECT COUNT(DISTINCT winner_user_id) AS count FROM draws WHERE winner_user_id IS NOT NULL").get().count;
  const rewards = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM coin_transactions WHERE amount > 0 AND reason IN ('lottery_win', 'jackpot_win')").get().total;
  const winners = db.prepare(`SELECT u.username, d.reward_amount AS reward, d.draw_date AS date FROM draws d JOIN users u ON u.id = d.winner_user_id WHERE d.winner_user_id IS NOT NULL ORDER BY d.draw_date DESC LIMIT 3`).all();
  res.json({
    currentJackpot: jackpot.poolAmount,
    nextDraw: { hour: config.game.drawHour, timezone: process.env.CRON_TIMEZONE || "UTC" },
    totalPlayers: playerCount,
    totalWinners: winnerCount,
    totalRewardsDistributed: rewards,
    totalPrizePool: (draw?.total_tickets_sold || 0) * config.game.ticketPrice,
    ticketsSold: draw?.total_tickets_sold || 0,
    recentWinners: winners,
    blockchainNetwork: "SCAI Mainnet",
    contractAddress: process.env.LLT_CONTRACT_ADDRESS || "0x290483A8fC8ed76647dA75260eb2a2594B5330a2",
  });
});

module.exports = router;
