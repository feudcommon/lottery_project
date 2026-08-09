// src/services/jackpotService.js
const crypto = require("crypto");
const db = require("../db/connection");
const config = require("../config");
const { AppError } = require("../middleware/errorHandler");

// Monday-anchored week key, timezone-aware like the rest of the app
function getWeekBounds(date = new Date()) {
  const tz = process.env.CRON_TIMEZONE || "UTC";
  const local = new Date(date.toLocaleString("en-US", { timeZone: tz }));
  const day = local.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(local);
  monday.setDate(local.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d) => d.toLocaleDateString("en-CA", { timeZone: tz });
  return { weekStart: fmt(monday), weekEnd: fmt(sunday) };
}

// `dbHandle` defaults to the module-level (auto-committing) connection, but
// callers running inside another transaction (see ticketService.buyTicket)
// pass their transaction-scoped handle instead, so this stays atomic with
// whatever it's being called from.
async function getOrCreateCurrentJackpot(dbHandle = db) {
  const { weekStart, weekEnd } = getWeekBounds();
  let jackpot = await dbHandle.prepare("SELECT * FROM jackpots WHERE week_start = ?").get(weekStart);
  if (!jackpot) {
    await dbHandle.prepare(`
      INSERT INTO jackpots (week_start, week_end, status, pool_amount)
      VALUES (?, ?, 'open', 0)
    `).run(weekStart, weekEnd);
    jackpot = await dbHandle.prepare("SELECT * FROM jackpots WHERE week_start = ?").get(weekStart);
  }
  return jackpot;
}

// Called from ticketService on every successful ticket purchase.
// Feeds a slice of the platform fee into this week's jackpot pool.
// Accepts an optional transaction handle for the same reason as above —
// ticketService.buyTicket calls this from inside its own db.transaction()
// so the jackpot contribution and the ticket purchase commit/rollback
// together.
async function contributeToJackpot(amount, dbHandle = db) {
  const jackpot = await getOrCreateCurrentJackpot(dbHandle);
  if (jackpot.status !== "open") return; // week already closed, skip
  await dbHandle.prepare("UPDATE jackpots SET pool_amount = pool_amount + ? WHERE id = ?")
    .run(amount, jackpot.id);
}

async function getCurrentJackpotStatus() {
  const jackpot = await getOrCreateCurrentJackpot();
  return {
    weekStart: jackpot.week_start,
    weekEnd: jackpot.week_end,
    status: jackpot.status,
    poolAmount: jackpot.pool_amount,
  };
}

// Entrants: one entry per unique user who bought >=1 ticket in the week's
// date range. Called at week-close to commit the seed (same commit-reveal
// pattern as the daily lottery).
async function closeWeekAndCommitSeed(weekStart) {
  const jackpot = await db.prepare("SELECT * FROM jackpots WHERE week_start = ?").get(weekStart);
  if (!jackpot) throw new AppError(`No jackpot found for week ${weekStart}`, 404);
  if (jackpot.status !== "open") return jackpot;

  const seed = crypto.randomBytes(32).toString("hex");
  const seedHash = crypto.createHash("sha256").update(seed).digest("hex");

  await db.prepare(`
    UPDATE jackpots
    SET status = 'closed', random_seed = ?, server_seed_hash = ?, closed_at = datetime('now')
    WHERE id = ?
  `).run(seed, seedHash, jackpot.id);

  console.log(`[Jackpot] Week ${weekStart} closed. Pool: ${jackpot.pool_amount}. Hash published: ${seedHash}`);
  return db.prepare("SELECT * FROM jackpots WHERE id = ?").get(jackpot.id);
}

const runJackpotDrawTransaction = db.transaction(async (tx, weekStart) => {
  const jackpot = await tx.prepare("SELECT * FROM jackpots WHERE week_start = ?").get(weekStart);
  if (!jackpot) throw new AppError(`No jackpot found for week ${weekStart}`, 404);
  if (jackpot.status === "drawn") throw new AppError("Jackpot already drawn", 400);
  if (jackpot.status !== "closed") throw new AppError("Jackpot must be closed before drawing", 400);

  const entrants = await tx.prepare(`
    SELECT DISTINCT user_id FROM tickets
    WHERE draw_date >= ? AND draw_date <= ?
    ORDER BY user_id
  `).all(jackpot.week_start, jackpot.week_end);

  if (entrants.length === 0) {
    await tx.prepare("UPDATE jackpots SET status = 'drawn', drawn_at = datetime('now') WHERE id = ?").run(jackpot.id);
    return { weekStart, winner: null, entrants: 0, poolAmount: jackpot.pool_amount };
  }

  const hash = crypto.createHash("sha256").update(jackpot.random_seed).digest("hex");
  const index = parseInt(hash.slice(0, 8), 16) % entrants.length;
  const winnerId = entrants[index].user_id;

  const winner = await tx.prepare("SELECT * FROM users WHERE id = ?").get(winnerId);
  const newBalance = winner.coins + jackpot.pool_amount;

  await tx.prepare("UPDATE users SET coins = ? WHERE id = ?").run(newBalance, winnerId);
  await tx.prepare(`
    INSERT INTO coin_transactions (user_id, amount, reason, reference_id, balance_after)
    VALUES (?, ?, 'jackpot_win', ?, ?)
  `).run(winnerId, jackpot.pool_amount, jackpot.id, newBalance);

  await tx.prepare(`
    UPDATE jackpots SET status = 'drawn', winner_user_id = ?, drawn_at = datetime('now') WHERE id = ?
  `).run(winnerId, jackpot.id);

  console.log(`[Jackpot] Winner for week ${weekStart}: user ${winnerId}, prize ${jackpot.pool_amount}`);

  return {
    weekStart,
    winner: { userId: winner.id, username: winner.username },
    entrants: entrants.length,
    poolAmount: jackpot.pool_amount,
    revealedSeed: jackpot.random_seed,
    publishedHashBeforeDraw: jackpot.server_seed_hash,
  };
});

async function runJackpotDraw(weekStart) {
  return runJackpotDrawTransaction(weekStart);
}

async function verifyJackpotFairness(weekStart) {
  const jackpot = await db.prepare("SELECT * FROM jackpots WHERE week_start = ?").get(weekStart);
  if (!jackpot || !jackpot.random_seed) throw new AppError("Jackpot not found or not yet drawn", 404);
  const recomputed = crypto.createHash("sha256").update(jackpot.random_seed).digest("hex");
  return {
    weekStart,
    hashMatches: recomputed === jackpot.server_seed_hash,
    publishedHashBeforeDraw: jackpot.server_seed_hash,
    revealedSeed: jackpot.random_seed,
    winnerUserId: jackpot.winner_user_id,
  };
}

async function getJackpotHistory(limit = 8) {
  return db.prepare("SELECT * FROM jackpots ORDER BY week_start DESC LIMIT ?").all(limit);
}

module.exports = {
  getWeekBounds,
  getOrCreateCurrentJackpot,
  contributeToJackpot,
  getCurrentJackpotStatus,
  closeWeekAndCommitSeed,
  runJackpotDraw,
  verifyJackpotFairness,
  getJackpotHistory,
};