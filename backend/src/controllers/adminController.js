// src/controllers/adminController.js

const db = require("../db/connection");
const withdrawalService = require("../services/withdrawalService");
const lotteryService = require("../services/lotteryService");
const blockchainService = require("../services/blockchainService");
const { asyncHandler, AppError } = require("../middleware/errorHandler");

// GET /api/admin/users
const listUsers = asyncHandler(async (req, res) => {
  const users = db
    .prepare("SELECT id, telegram_id, username, coins, referral_count, wallet_address, is_banned, created_at FROM users ORDER BY created_at DESC LIMIT 200")
    .all();
  res.json({ users });
});

// GET /api/admin/tickets/:date  e.g. /api/admin/tickets/2026-06-18
const getTicketSales = asyncHandler(async (req, res) => {
  const { date } = req.params;
  const tickets = db
    .prepare(`
      SELECT t.*, u.username, u.telegram_id
      FROM tickets t JOIN users u ON u.id = t.user_id
      WHERE t.draw_date = ?
      ORDER BY t.ticket_number
    `)
    .all(date);
  const draw = lotteryService.getDraw(date);
  res.json({ date, draw, tickets });
});

// GET /api/admin/withdrawals/pending
const getPendingWithdrawals = asyncHandler(async (req, res) => {
  const withdrawals = withdrawalService.listPendingWithdrawals();
  res.json({ withdrawals });
});

// POST /api/admin/withdrawals/:id/approve
// Manual-approval flow: admin reviews, then this either calls the chain
// directly (if configured) or just records intent for an off-process payout.
const approveWithdrawal = asyncHandler(async (req, res) => {
  const withdrawalId = parseInt(req.params.id, 10);
  const withdrawal = db.prepare("SELECT * FROM withdrawals WHERE id = ?").get(withdrawalId);
  if (!withdrawal || withdrawal.status !== "pending") {
    throw new AppError("Withdrawal not found or already processed", 404);
  }

  const result = await blockchainService.sendTokensOnChain(
    withdrawal.wallet_address,
    withdrawal.token_amount
  );

  if (!result.success) {
    throw new AppError(`Blockchain error: ${result.error}`, 500);
  }

  const updated = withdrawalService.markWithdrawalSent(withdrawalId, result.transferHash);
  return res.json({ message: "Tokens sent", withdrawal: updated });
});
// POST /api/admin/withdrawals/:id/reject
const rejectWithdrawal = asyncHandler(async (req, res) => {
  const withdrawalId = parseInt(req.params.id, 10);
  const { reason } = req.body;
  const result = withdrawalService.rejectWithdrawal(withdrawalId, reason || "No reason given");
  res.json({ message: "Withdrawal rejected and coins refunded", ...result });
});

// POST /api/admin/draw/:date/run  -- manual override to force-run a draw
const forceDraw = asyncHandler(async (req, res) => {
  const { date } = req.params;
  const result = lotteryService.runDraw(date);
  res.json({ message: "Draw executed", result });
});

// GET /api/admin/draw/:date/verify -- fairness check, also public-facing (see routes)
const verifyDraw = asyncHandler(async (req, res) => {
  const { date } = req.params;
  const result = lotteryService.verifyDrawFairness(date);
  res.json(result);
});
const jackpotService = require("../services/jackpotService");

const closeJackpot = asyncHandler(async (req, res) => {
  const result = jackpotService.closeWeekAndCommitSeed(req.params.weekStart);
  res.json({ message: "Jackpot week closed", jackpot: result });
});

const forceJackpotDraw = asyncHandler(async (req, res) => {
  const result = jackpotService.runJackpotDraw(req.params.weekStart);
  res.json({ message: "Jackpot draw executed", result });
});


module.exports = {
  listUsers,
  getTicketSales,
  getPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  forceDraw,
  verifyDraw,
  closeJackpot,
  forceJackpotDraw,
};
