// src/controllers/jackpotController.js
const jackpotService = require("../services/jackpotService");
const { asyncHandler } = require("../middleware/errorHandler");

const getStatus = asyncHandler(async (req, res) => {
  res.json(jackpotService.getCurrentJackpotStatus());
});

const getHistory = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 8;
  res.json({ history: jackpotService.getJackpotHistory(limit) });
});

const verify = asyncHandler(async (req, res) => {
  res.json(jackpotService.verifyJackpotFairness(req.params.weekStart));
});

module.exports = { getStatus, getHistory, verify };