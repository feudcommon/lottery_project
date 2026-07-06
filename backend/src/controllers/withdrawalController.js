// src/controllers/withdrawalController.js

const withdrawalService = require("../services/withdrawalService");
const { asyncHandler } = require("../middleware/errorHandler");

// POST /api/withdraw
const withdraw = asyncHandler(async (req, res) => {
  const { walletAddress, amountCoins } = req.body;
  const result = await withdrawalService.requestWithdrawal(req.user.id, walletAddress, amountCoins);
  res.status(201).json({
    message: "Withdrawal request submitted and pending processing.",
    withdrawal: result,
  });
});

// GET /api/withdraw/eligibility
const getEligibility = asyncHandler(async (req, res) => {
  const result = withdrawalService.checkEligibility(req.user);
  res.json(result);
});

// GET /api/withdraw/history
const getHistory = asyncHandler(async (req, res) => {
  const withdrawals = withdrawalService.getMyWithdrawals(req.user.id);
  res.json({ withdrawals });
});

module.exports = { withdraw, getEligibility, getHistory };
