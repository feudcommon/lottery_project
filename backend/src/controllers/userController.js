// src/controllers/userController.js

const { getUserById, getPublicProfile } = require("../services/userService");
const { getTransactionHistory } = require("../services/coinService");
const { asyncHandler, AppError } = require("../middleware/errorHandler");

// GET /api/user/:id/coins
// Note: even though :id is in the URL, we ALWAYS check it against
// req.user (set by requireAuth) — a user can only ever view their OWN
// coin balance through this endpoint, regardless of what id is in the URL.
// This prevents "GET /user/47/coins" from leaking user 47's data to a
// logged-in user who is actually user 12.
const getCoins = asyncHandler(async (req, res) => {
  const requestedId = parseInt(req.params.id, 10);

  if (requestedId !== req.user.id) {
    throw new AppError("You can only view your own balance", 403);
  }

  res.json({
    userId: req.user.id,
    coins: req.user.coins,
  });
});

const getMe = asyncHandler(async (req, res) => {
  res.json({ user: getPublicProfile(req.user) });
});

const getMyHistory = asyncHandler(async (req, res) => {
  const history = getTransactionHistory(req.user.id);
  res.json({ history });
});

module.exports = { getCoins, getMe, getMyHistory };
