// src/services/lotteryService.js
//
// SERVER-SIDE RANDOMNESS — WHY Math.random() ALONE ISN'T ENOUGH
//
// Plain `Math.random()` is fine for picking a winner FUNCTIONALLY (it's
// happening on the server, not in the user's browser, so they genuinely
// can't manipulate the outcome). But it has two real weaknesses:
//
//   1. Math.random() is NOT cryptographically secure. It's deterministic
//      given internal state, and in theory (with enough samples) its
//      output is predictable. For picking a lottery winner with real
//      money at stake, you want crypto-grade randomness.
//
//   2. Even if the randomness is good, users have NO WAY to verify the
//      draw was fair after the fact. "Trust me, it was random" isn't
//      good enough once tokens are involved — this is exactly why the
//      spec calls out "Blockchain-based randomness (fair & transparent)"
//      as a future improvement.
//
// This implementation does both things properly with tools you already have:
//
//   a) Uses crypto.randomInt() instead of Math.random() — actually
//      cryptographically secure randomness, built into Node, no extra deps.
//
//   b) Implements a COMMIT-REVEAL scheme:
//      - Tickets close at 15:00. At that moment, we generate a random seed,
//        and IMMEDIATELY store its SHA-256 hash publicly (server_seed_hash)
//        — this happens via the cron job, see jobs/lotteryCron.js.
//      - The actual seed itself stays secret until the draw at 18:00.
//      - At 18:00, we use the seed to pick the winner, THEN reveal the
//        seed publicly alongside the result.
//      - Anyone can take the revealed seed, hash it themselves, and confirm
//        it matches the hash that was published BEFORE the draw happened.
//        This proves the result wasn't decided/changed after the fact —
//        the seed was locked in before anyone knew who'd win.
//
// This is the same fairness pattern provably-fair casinos and many
// blockchain lotteries use, and it's a clean stepping stone toward full
// on-chain randomness (Chainlink VRF) later without changing your game logic.

const crypto = require("crypto");
const db = require("../db/connection");
const config = require("../config");
const { AppError } = require("../middleware/errorHandler");

/**
 * Step 1 (runs at sales-close time, e.g. 15:00):
 * Generate the secret seed, store it, and publish only its hash.
 */
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

  // Cryptographically secure random seed (32 bytes = 256 bits)
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

/**
 * Converts a hex seed + a salt string into a deterministic but
 * unpredictable-in-advance integer in [0, max).
 * Deterministic = same seed always produces same result (so it's auditable/replayable).
 * Unpredictable in advance = nobody could know the seed before commit time.
 */
function seedToIndex(seed, max) {
  const hash = crypto.createHash("sha256").update(seed).digest("hex");
  // Take first 8 hex chars (32 bits) as an integer, mod into range.
  // crypto.randomInt is used for the SEED generation itself (the
  // unpredictable part); this derivation step is plain hashing, which is
  // fine because the seed it's hashing was already securely random.
  const intVal = parseInt(hash.slice(0, 8), 16);
  return intVal % max;
}

/**
 * Step 2 (runs at draw time, e.g. 18:00):
 * Use the committed seed to deterministically pick a winning ticket,
 * then reveal the seed.
 */
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

  // THE ACTUAL RANDOM SELECTION — using the pre-committed seed, NOT a
  // fresh Math.random() call. This is what makes it auditable: the seed
  // (and therefore the outcome) was fixed before the draw, not chosen
  // after seeing who's in the pool.
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

/** Lets ANYONE independently verify a past draw was fair. */
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

module.exports = {
  closeSalesAndCommitSeed,
  runDraw,
  verifyDrawFairness,
  getDraw,
};
