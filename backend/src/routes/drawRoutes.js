const express = require("express");
const router = express.Router();
const lotteryService = require("../services/lotteryService");
const { asyncHandler, AppError } = require("../middleware/errorHandler");
const { globalLimiter } = require("../middleware/rateLimiter");

// GET /api/draws/history?days=7  ← ADD THIS
router.get(
  "/history",
  globalLimiter,
  asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 7;
    const draws = lotteryService.getDrawHistory(days);
    res.json({ draws });
  })
);

// GET /api/draws/:date (existing)
router.get(
  "/:date",
  globalLimiter,
  asyncHandler(async (req, res) => {
    // ... existing code ...
  })
);

// ... rest of existing routes ...