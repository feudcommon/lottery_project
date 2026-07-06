const crypto = require("crypto");
const db = require("../db/connection");
const config = require("../config");
const { AppError } = require("../middleware/errorHandler");

function closeSalesAndCommitSeed(drawDate) {
  const draw = db.prepare("SELECT * FROM draws WHERE draw_date = ?").get(drawDate);
  if (!draw) {
    console.warn(`No draw row for ${drawDate} — nothing to close (zero tickets sold today?)`);
    return null;
  }
  if (draw.status !== "open") {
    console.warn(`Draw ${drawDate} already closed/drawn, skipping.`);
    return draw;
  }

  const seed = crypto.randomBytes(32).toString("hex");
  const seedHash = crypto.createHash("sha256").update(seed).digest("hex");

  db.prepare(`
    UPDATE draws
    SET status = 'closed', random_seed = ?, server_seed_hash = ?, closed_at = datetime('now')
    WHERE draw_date = ?
  `).run(seed, seedHash, drawDate);

  console.log(`[Lottery] Sales closed for ${drawDate}. Seed committed (hash published): ${seedHash}`);

  return db.prepare("SELECT * FROM draws WHERE draw_date = ?").get(drawDate);
}

function seedToIndex(seed, max) {
  const hash = crypto.createHash("sha256").update(seed).digest("hex");
  const intVal = parseInt(hash.slice(0, 8), 16);
  return intVal % max;
}

const runDrawTransaction = db.transaction((drawDate) => {
  const draw = db.prepare("SELECT * FROM draws WHERE draw_date = ?").get(drawDate);
  if (!draw) throw new AppError(`No draw found for ${drawDate}`, 404);
  if (draw.status === "drawn") {
    throw new AppError(`Draw for ${drawDate} already completed`, 400);
  }
  if (draw.status !== "closed") {
    throw new AppError(`Draw for ${drawDate} must be closed before drawing (current: ${draw.status})`, 400);
  }

  const tickets = db
    .prepare("SELECT * FROM tickets WHERE draw_date = ? ORDER BY ticket_number")
    .all(drawDate);

  if (tickets.length === 0) {
    db.prepare("UPDATE draws SET status = 'drawn', drawn_at = datetime('now') WHERE draw_date = ?").run(
      drawDate
    );
    console.log(`[Lottery] No tickets sold for ${drawDate}, no winner.`);
    return { drawDate, winner: null, tickets: 0 };
  }

  const winningIndex = seedToIndex(draw.random_seed, tickets.length);
  const winningTicket = tickets[winningIndex];

  const winner = db.prepare("SELECT * FROM users WHERE id = ?").get(winningTicket.user_id);
  const newBalance = winner.coins + config.game.winnerReward;

  db.prepare("UPDATE users SET coins = ? WHERE id = ?").run(newBalance, winner.id);

  db.prepare(`
    INSERT INTO coin_transactions (user_id, amount, reason, reference_id, balance_after)
    VALUES (?, ?, 'lottery_win', ?, ?)
  `).run(winner.id, config.game.winnerReward, draw.id, newBalance);

  db.prepare(`
    UPDATE draws
    SET status = 'drawn', winner_user_id = ?, winner_ticket_id = ?, reward_amount = ?, drawn_at = datetime('now')
    WHERE draw_date = ?
  `).run(winner.id, winningTicket.id, config.game.winnerReward, drawDate);

  console.log(
    `[Lottery] Draw complete for ${drawDate}. Winner: user ${winner.id} (ticket #${winningTicket.ticket_number}). Seed revealed: ${draw.random_seed}`
  );

  return {
    drawDate,
    winner: { userId: winner.id, username: winner.username },
    winningTicketNumber: winningTicket.ticket_number,
    totalTickets: tickets.length,
    rewardAmount: config.game.winnerReward,
    revealedSeed: draw.random_seed,
    publishedHashBeforeDraw: draw.server_seed_hash,
  };
});

function runDraw(drawDate) {
  return runDrawTransaction(drawDate);
}

function verifyDrawFairness(drawDate) {
  const draw = db.prepare("SELECT * FROM draws WHERE draw_date = ?").get(drawDate);
  if (!draw || !draw.random_seed) {
    throw new AppError("Draw not found or not yet completed", 404);
  }
  const recomputedHash = crypto.createHash("sha256").update(draw.random_seed).digest("hex");
  const hashMatches = recomputedHash === draw.server_seed_hash;

  const tickets = db
    .prepare("SELECT * FROM tickets WHERE draw_date = ? ORDER BY ticket_number")
    .all(drawDate);
  const recomputedIndex = tickets.length > 0 ? seedToIndex(draw.random_seed, tickets.length) : null;
  const recomputedWinnerTicketId = recomputedIndex !== null ? tickets[recomputedIndex].id : null;

  return {
    drawDate,
    publishedHashBeforeDraw: draw.server_seed_hash,
    revealedSeed: draw.random_seed,
    hashMatches, // true = seed was genuinely committed before the draw, untampered
    recomputedWinnerTicketId,
    matchesRecordedWinner: recomputedWinnerTicketId === draw.winner_ticket_id,
  };
}

function getDraw(drawDate) {
  return db.prepare("SELECT * FROM draws WHERE draw_date = ?").get(drawDate);
}

function getDrawHistory(days = 7) {
  const draws = db.prepare(`
    SELECT * FROM draws 
    ORDER BY draw_date DESC 
    LIMIT ?
  `).all(days);
  
  return draws || [];
}
module.exports = {
  closeSalesAndCommitSeed,
  runDraw,
  verifyDrawFairness,
  getDraw,
  getDrawHistory,  // ✅ ADD THIS
};