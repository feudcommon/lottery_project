// src/routes/drawRoutes.js
//
// Public, unauthenticated routes related to lottery draws. The fairness
// verification endpoint is intentionally public — the whole point of the
// commit-reveal scheme is that ANYONE (not just admins) can independently
// confirm a past draw wasn't rigged.
const express = require("express");
const router = express.Router();
const lotteryService = require("../services/lotteryService");
const { asyncHandler, AppError } = require("../middleware/errorHandler");
const { globalLimiter } = require("../middleware/rateLimiter");

// GET /api/draws/history?days=7
// Returns recent draw history (last N days)
router.get(
  "/history",
  globalLimiter,
  asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 7;
    const draws = lotteryService.getDrawHistory(days);
    res.json({ draws });
  })
);

// GET /api/draws/:date
// Returns a specific draw by date
router.get(
  "/:date",
  globalLimiter,
  asyncHandler(async (req, res) => {
    const draw = lotteryService.getDraw(req.params.date);
    if (!draw) throw new AppError("No draw found for that date", 404);
    // Hide the seed itself until the draw has actually happened —
    // only the hash is public pre-draw, per the commit-reveal design.
    const isRevealed = draw.status === "drawn";
    res.json({
      drawDate: draw.draw_date,
      status: draw.status,
      totalTicketsSold: draw.total_tickets_sold,
      serverSeedHash: draw.server_seed_hash,
      randomSeed: isRevealed ? draw.random_seed : undefined,
      winnerUserId: isRevealed ? draw.winner_user_id : undefined,
      rewardAmount: isRevealed ? draw.reward_amount : undefined,
    });
  })
);

// GET /api/draws/:date/verify
// Verifies the fairness of a draw using commit-reveal
router.get(
  "/:date/verify",
  globalLimiter,
  asyncHandler(async (req, res) => {
    const result = lotteryService.verifyDrawFairness(req.params.date);
    res.json(result);
  })
);

module.exports = router;