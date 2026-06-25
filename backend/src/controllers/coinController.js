// src/controllers/coinController.js

const coinService = require("../services/coinService");
const { asyncHandler } = require("../middleware/errorHandler");

// POST /api/spin
const spin = asyncHandler(async (req, res) => {
  const result = coinService.spin(req.user.id);
  res.json({ message: `You won ${result.reward} coins!`, ...result });
});

module.exports = { spin };
