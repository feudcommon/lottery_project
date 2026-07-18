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

function getOrCreateCurrentJackpot() {
  const { weekStart, weekEnd } = getWeekBounds();
  let jackpot = db.prepare("SELECT * FROM jackpots WHERE week_start = ?").get(weekStart);
  if (!jackpot) {
    db.prepare(`
      INSERT INTO jackpots (week_start, week_end, status, pool_amount)
      VALUES (?, ?, 'open', 0)
    `).run(weekStart, weekEnd);
    jackpot = db.prepare("SELECT * FROM jackpots WHERE week_start = ?").get(weekStart);
  }
  return jackpot;
}

// Called from ticketService on every successful ticket purchase.
// Feeds a slice of the platform fee into this week's jackpot pool.
function contributeToJackpot(amount) {
  const jackpot = getOrCreateCurrentJackpot();
  if (jackpot.status !== "open") return; // week already closed, skip
  db.prepare("UPDATE jackpots SET pool_amount = pool_amount + ? WHERE id = ?")
    .run(amount, jackpot.id);
}

function getCurrentJackpotStatus() {
  const jackpot = getOrCreateCurrentJackpot();
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
function closeWeekAndCommitSeed(weekStart) {
  const jackpot = db.prepare("SELECT * FROM jackpots WHERE week_start = ?").get(weekStart);
  if (!jackpot) throw new AppError(`No jackpot found for week ${weekStart}`, 404);
  if (jackpot.status !== "open") return jackpot;

  const seed = crypto.randomBytes(32).toString("hex");
  const seedHash = crypto.createHash("sha256").update(seed).digest("hex");

  db.prepare(`
    UPDATE jackpots
    SET status = 'closed', random_seed = ?, server_seed_hash = ?, closed_at = datetime('now')
    WHERE id = ?
  `).run(seed, seedHash, jackpot.id);

  console.log(`[Jackpot] Week ${weekStart} closed. Pool: ${jackpot.pool_amount}. Hash published: ${seedHash}`);
  return db.prepare("SELECT * FROM jackpots WHERE id = ?").get(jackpot.id);
}

const runJackpotDrawTransaction = db.transaction((weekStart) => {
  const jackpot = db.prepare("SELECT * FROM jackpots WHERE week_start = ?").get(weekStart);
  if (!jackpot) throw new AppError(`No jackpot found for week ${weekStart}`, 404);
  if (jackpot.status === "drawn") throw new AppError("Jackpot already drawn", 400);
  if (jackpot.status !== "closed") throw new AppError("Jackpot must be closed before drawing", 400);

  const entrants = db.prepare(`
    SELECT DISTINCT user_id FROM tickets
    WHERE draw_date >= ? AND draw_date <= ?
    ORDER BY user_id
  `).all(jackpot.week_start, jackpot.week_end);

  if (entrants.length === 0) {
    db.prepare("UPDATE jackpots SET status = 'drawn', drawn_at = datetime('now') WHERE id = ?").run(jackpot.id);
    return { weekStart, winner: null, entrants: 0, poolAmount: jackpot.pool_amount };
  }

  const hash = crypto.createHash("sha256").update(jackpot.random_seed).digest("hex");
  const index = parseInt(hash.slice(0, 8), 16) % entrants.length;
  const winnerId = entrants[index].user_id;

  const winner = db.prepare("SELECT * FROM users WHERE id = ?").get(winnerId);
  const newBalance = winner.coins + jackpot.pool_amount;

  db.prepare("UPDATE users SET coins = ? WHERE id = ?").run(newBalance, winnerId);
  db.prepare(`
    INSERT INTO coin_transactions (user_id, amount, reason, reference_id, balance_after)
    VALUES (?, ?, 'jackpot_win', ?, ?)
  `).run(winnerId, jackpot.pool_amount, jackpot.id, newBalance);

  db.prepare(`
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

function runJackpotDraw(weekStart) {
  return runJackpotDrawTransaction(weekStart);
}

function verifyJackpotFairness(weekStart) {
  const jackpot = db.prepare("SELECT * FROM jackpots WHERE week_start = ?").get(weekStart);
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

function getJackpotHistory(limit = 8) {
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