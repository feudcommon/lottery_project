// src/controllers/drawsController.js
const drawsService = require("../services/drawsService");
const { asyncHandler } = require("../middleware/errorHandler");

// GET /api/draws/history?days=7
const getDrawHistory = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const draws = drawsService.getDrawHistory(days);
  res.json({ draws });
});

// GET /api/draws/today
const getTodaysDraw = asyncHandler(async (req, res) => {
  const draw = drawsService.getTodaysDraw();
  res.json(draw);
});

module.exports = { getDrawHistory, getTodaysDraw };