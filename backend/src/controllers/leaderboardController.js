// src/controllers/leaderboardController.js
const leaderboardService = require("../services/leaderboardService");
const { asyncHandler } = require("../middleware/errorHandler");

// GET /api/leaderboard?limit=20
const getLeaderboard = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const top = leaderboardService.getTopByCoins(limit);
  const myRank = req.user ? leaderboardService.getUserRank(req.user.id) : null;
  res.json({ leaderboard: top, myRank });
});

module.exports = { getLeaderboard };