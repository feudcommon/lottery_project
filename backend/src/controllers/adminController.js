// src/controllers/adminController.js

const db = require("../db/connection");
const withdrawalService = require("../services/withdrawalService");
const lotteryService = require("../services/lotteryService");
const blockchainService = require("../services/blockchainService");
const jackpotService = require("../services/jackpotService");
const { asyncHandler, AppError } = require("../middleware/errorHandler");

// GET /api/admin/users
const listUsers = asyncHandler(async (req, res) => {
  const users = await db
    .prepare("SELECT id, telegram_id, username, coins, referral_count, wallet_address, is_banned, is_admin, created_at FROM users ORDER BY created_at DESC LIMIT 200")
    .all();
  res.json({ users });
});

// POST /api/admin/users/:id/promote — grants admin access to another
// account. This is the "give access to somebody else" mechanism: no env
// vars, no redeploy, just an existing admin clicking a button for a user
// they already see in this same list.
const promoteToAdmin = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const user = await db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) throw new AppError("User not found", 404);

  await db.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").run(userId);
  const updated = await db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  res.json({ message: `${user.username || `User #${user.id}`} is now an admin.`, user: updated });
});

// POST /api/admin/users/:id/demote — revokes it again. Note: this only
// clears the DB flag — if that same account is also listed in the
// ADMIN_TELEGRAM_IDS / ADMIN_WALLET_ADDRESSES env vars, it stays an admin
// through that allowlist until removed from the env var too.
const demoteFromAdmin = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const user = await db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) throw new AppError("User not found", 404);

  await db.prepare("UPDATE users SET is_admin = 0 WHERE id = ?").run(userId);
  const updated = await db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  res.json({ message: `${user.username || `User #${user.id}`} is no longer an admin.`, user: updated });
});

// GET /api/admin/tickets/:date  e.g. /api/admin/tickets/2026-06-18
const getTicketSales = asyncHandler(async (req, res) => {
  const { date } = req.params;
  const tickets = await db
    .prepare(`
      SELECT t.*, u.username, u.telegram_id
      FROM tickets t JOIN users u ON u.id = t.user_id
      WHERE t.draw_date = ?
      ORDER BY t.ticket_number
    `)
    .all(date);
  const draw = await lotteryService.getDraw(date);
  res.json({ date, draw, tickets });
});

// GET /api/admin/withdrawals/pending
const getPendingWithdrawals = asyncHandler(async (req, res) => {
  const withdrawals = await withdrawalService.listPendingWithdrawals();
  res.json({ withdrawals });
});

// POST /api/admin/withdrawals/:id/approve
// Manual-approval flow: admin reviews, then this either calls the chain
// directly (if configured) or just records intent for an off-process payout.
const approveWithdrawal = asyncHandler(async (req, res) => {
  const withdrawalId = parseInt(req.params.id, 10);
  const withdrawal = await db.prepare("SELECT * FROM withdrawals WHERE id = ?").get(withdrawalId);
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

  const updated = await withdrawalService.markWithdrawalSent(withdrawalId, result.transferHash);
  return res.json({ message: "Tokens sent", withdrawal: updated });
});
// POST /api/admin/withdrawals/:id/reject
const rejectWithdrawal = asyncHandler(async (req, res) => {
  const withdrawalId = parseInt(req.params.id, 10);
  const { reason } = req.body;
  const result = await withdrawalService.rejectWithdrawal(withdrawalId, reason || "No reason given");
  res.json({ message: "Withdrawal rejected and coins refunded", ...result });
});

// POST /api/admin/draw/:date/run  -- manual override to force-run a draw
const forceDraw = asyncHandler(async (req, res) => {
  const { date } = req.params;
  const result = await lotteryService.runDraw(date);
  res.json({ message: "Draw executed", result });
});

// POST /api/admin/draw/:date/payout -- send that draw's winner their prize on-chain now
const payoutDrawWinner = asyncHandler(async (req, res) => {
  const { date } = req.params;
  const result = await withdrawalService.payoutDrawWinner(date);
  res.json({ message: "Winner paid out on-chain", result });
});

// GET /api/admin/draw/:date/verify -- fairness check, also public-facing (see routes)
const verifyDraw = asyncHandler(async (req, res) => {
  const { date } = req.params;
  const result = await lotteryService.verifyDrawFairness(date);
  res.json(result);
});

const closeJackpot = asyncHandler(async (req, res) => {
  const result = await jackpotService.closeWeekAndCommitSeed(req.params.weekStart);
  res.json({ message: "Jackpot week closed", jackpot: result });
});

const forceJackpotDraw = asyncHandler(async (req, res) => {
  const result = await jackpotService.runJackpotDraw(req.params.weekStart);
  res.json({ message: "Jackpot draw executed", result });
});

// POST /api/admin/jackpot/:weekStart/payout -- send that jackpot's winner their prize on-chain now
const payoutJackpotWinner = asyncHandler(async (req, res) => {
  const result = await withdrawalService.payoutJackpotWinner(req.params.weekStart);
  res.json({ message: "Jackpot winner paid out on-chain", result });
});


module.exports = {
  listUsers,
  promoteToAdmin,
  demoteFromAdmin,
  getTicketSales,
  getPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  forceDraw,
  payoutDrawWinner,
  verifyDraw,
  closeJackpot,
  forceJackpotDraw,
  payoutJackpotWinner,
};