const crypto = require("crypto");
const db = require("../db/connection");
const config = require("../config");
const { AppError } = require("../middleware/errorHandler");
const { sendTelegramMessage } = require("./telegramService");
const { createNotification } = require("./notificationService");

// ─── PATCH ──────────────────────────────────────────────────────────────────
// Previously, if a day had zero ticket sales, no `draws` row ever got
// created (buyTicketTransaction is the only other place that creates one,
// and it never runs when nobody buys a ticket). closeSalesAndCommitSeed used
// to just warn and return null in that case, leaving nothing for runDraw to
// operate on a few hours later — which then threw "No draw found" and
// crashed that day's draw cron job.
//
// Fix: create the row here too (status 'open') before proceeding, so a
// zero-ticket day still gets closed and drawn cleanly (runDraw already
// handles the tickets.length === 0 case fine — it marks the draw 'drawn'
// with winner: null).
// ────────────────────────────────────────────────────────────────────────────
async function closeSalesAndCommitSeed(drawDate) {
  let draw = await db.prepare("SELECT * FROM draws WHERE draw_date = ?").get(drawDate);

  if (!draw) {
    await db.prepare("INSERT INTO draws (draw_date, status) VALUES (?, 'open')").run(drawDate);
    draw = await db.prepare("SELECT * FROM draws WHERE draw_date = ?").get(drawDate);
    console.log(`[Lottery] No tickets sold for ${drawDate} — created empty draw row so it can still be closed/drawn.`);
  }

  if (draw.status !== "open") {
    console.warn(`Draw ${drawDate} already closed/drawn, skipping.`);
    return draw;
  }

  const seed = crypto.randomBytes(32).toString("hex");
  const seedHash = crypto.createHash("sha256").update(seed).digest("hex");

  await db.prepare(`
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

const runDrawTransaction = db.transaction(async (tx, drawDate) => {
  const draw = await tx.prepare("SELECT * FROM draws WHERE draw_date = ?").get(drawDate);
  if (!draw) throw new AppError(`No draw found for ${drawDate}`, 404);
  if (draw.status === "drawn") {
    throw new AppError(`Draw for ${drawDate} already completed`, 400);
  }
  if (draw.status !== "closed") {
    throw new AppError(`Draw for ${drawDate} must be closed before drawing (current: ${draw.status})`, 400);
  }

  const tickets = await tx
    .prepare("SELECT * FROM tickets WHERE draw_date = ? ORDER BY ticket_number")
    .all(drawDate);

  if (tickets.length === 0) {
    await tx.prepare("UPDATE draws SET status = 'drawn', drawn_at = datetime('now') WHERE draw_date = ?").run(
      drawDate
    );
    console.log(`[Lottery] No tickets sold for ${drawDate}, no winner.`);
    return { drawDate, winner: null, tickets: 0 };
  }

  const winningIndex = seedToIndex(draw.random_seed, tickets.length);
  const winningTicket = tickets[winningIndex];

  const winner = await tx.prepare("SELECT * FROM users WHERE id = ?").get(winningTicket.user_id);
  const newBalance = winner.coins + config.game.winnerReward;

  await tx.prepare("UPDATE users SET coins = ? WHERE id = ?").run(newBalance, winner.id);

  await tx.prepare(`
    INSERT INTO coin_transactions (user_id, amount, reason, reference_id, balance_after)
    VALUES (?, ?, 'lottery_win', ?, ?)
  `).run(winner.id, config.game.winnerReward, draw.id, newBalance);

  await tx.prepare(`
    UPDATE draws
    SET status = 'drawn', winner_user_id = ?, winner_ticket_id = ?, reward_amount = ?, drawn_at = datetime('now')
    WHERE draw_date = ?
  `).run(winner.id, winningTicket.id, config.game.winnerReward, drawDate);

  console.log(
    `[Lottery] Draw complete for ${drawDate}. Winner: user ${winner.id} (ticket #${winningTicket.ticket_number}). Seed revealed: ${draw.random_seed}`
  );

  return {
    drawDate,
    drawId: draw.id,
    winner: {
      userId: winner.id,
      username: winner.username,
      telegramId: winner.telegram_id,
    },
    winningTicketNumber: winningTicket.ticket_number,
    totalTickets: tickets.length,
    rewardAmount: config.game.winnerReward,
    revealedSeed: draw.random_seed,
    publishedHashBeforeDraw: draw.server_seed_hash,
  };
});

async function runDraw(drawDate) {
  const result = await runDrawTransaction(drawDate);

  // Notify the winner AFTER the transaction has committed — network calls
  // (Telegram API, DB insert) must never sit inside or be able to roll
  // back the transaction that actually pays out the win.
  if (result.winner?.userId) {
    const { userId, username, telegramId } = result.winner;

    // In-app notification: works for every user, including wallet-only
    // players with no Telegram identity. Shown next time they open the site.
    createNotification({
      userId,
      type: "lottery_win",
      title: "🎉 You won today's draw!",
      message:
        `Your ticket #${result.winningTicketNumber} won the ${drawDate} Lucky Loop draw. ` +
        `${result.rewardAmount} coins have been added to your balance.`,
      referenceId: result.drawId,
    }).catch((err) => console.error("[Lottery] Failed to create winner notification:", err));

    // Telegram DM: bonus channel for users who logged in via Telegram and
    // have opened a chat with the bot. Silently skipped otherwise.
    if (telegramId) {
      sendTelegramMessage(
        telegramId,
        `🎉 <b>Congratulations${username ? `, ${username}` : ""}!</b>\n\n` +
          `You won today's Lucky Loop draw (${drawDate})!\n` +
          `🎟️ Winning ticket: #${result.winningTicketNumber}\n` +
          `💰 Reward: ${result.rewardAmount} coins have been added to your balance.\n\n` +
          `Good luck in the next draw! 🍀`,
      ).catch((err) => console.error("[Lottery] Failed to send winner notification:", err));
    }
  }

  return result;
}

async function verifyDrawFairness(drawDate) {
  const draw = await db.prepare("SELECT * FROM draws WHERE draw_date = ?").get(drawDate);
  if (!draw || !draw.random_seed) {
    throw new AppError("Draw not found or not yet completed", 404);
  }
  const recomputedHash = crypto.createHash("sha256").update(draw.random_seed).digest("hex");
  const hashMatches = recomputedHash === draw.server_seed_hash;

  const tickets = await db
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

async function getDraw(drawDate) {
  return db.prepare("SELECT * FROM draws WHERE draw_date = ?").get(drawDate);
}

async function getDrawHistory(days = 7) {
  const draws = await db.prepare(`
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
  getDrawHistory,
};