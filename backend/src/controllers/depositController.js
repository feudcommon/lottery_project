// src/controllers/depositController.js

const depositService = require("../services/depositService");
const { asyncHandler } = require("../middleware/errorHandler");

// GET /api/deposit/info — treasury address + current rate, for the frontend to render
const getInfo = asyncHandler(async (req, res) => {
  const result = depositService.getTreasuryAddress();
  res.json(result);
});

// POST /api/deposit — body: { txHash }, after the user's wallet sends SCAI to the treasury
const deposit = asyncHandler(async (req, res) => {
  const { txHash } = req.body;
  const result = await depositService.creditScaiDeposit(req.user.id, txHash);
  res.status(201).json({
    message: "Deposit verified and coins credited.",
    ...result,
  });
});

// GET /api/deposit/history
const getHistory = asyncHandler(async (req, res) => {
  const deposits = depositService.getMyDeposits(req.user.id);
  res.json({ deposits });
});

module.exports = { getInfo, deposit, getHistory };