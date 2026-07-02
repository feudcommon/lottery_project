// src/services/ticketService.js
//
// THE MOST IMPORTANT FILE FOR PREVENTING COIN ABUSE.
//
// The risk: two requests from the same user (or a script firing requests
// rapidly) could both read "user has 50 coins" at the same time, both
// decide "ok, they can afford a ticket", and both deduct 10 coins —
// resulting in 2 tickets for the price of 1, or worse, going negative.
//
// The fix: wrap the entire "check + deduct + reserve ticket" sequence in
// a SQLite transaction. better-sqlite3 transactions are synchronous and
// the whole project runs single-threaded for these operations, so once a
// transaction starts, no other request can interleave with it. Combined
// with the UNIQUE(date, slot_number) constraint from the schema,
// a ticket slot literally cannot be sold twice even if our app logic had
// a bug — the database itself refuses the second insert.

const db = require("../db/connection");
const config = require("../config");
const { AppError } = require("../middleware/errorHandler");
const { markReferralActiveIfNeeded } = require("./userService");

function todayDateString() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function getCurrentHour() {
  return new Date().getHours();
}

function isSalesOpen() {
  const hour = getCurrentHour();
  return hour >= config.game.salesOpenHour && hour < config.game.salesCloseHour;
}

/**
 * Returns how many ticket slots are still available for a given draw date.
 */
function getAvailableTicketCount(drawDate) {
  const sold = db
    .prepare("SELECT COUNT(*) as count FROM tickets WHERE date = ?")
    .get(drawDate).count;
  return Math.max(0, config.game.totalTicketsPerDay - sold);
}

/**
 * The core, safety-critical operation: buy one ticket.
 * Wrapped in db.transaction so it's all-or-nothing and race-condition-free.
 */
const buyTicketTransaction = db.transaction((userId, drawDate) => {
  // 1. Lock in current state by reading fresh inside the transaction
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) throw new AppError("User not found", 404);
  if (user.is_banned) throw new AppError("Account suspended", 403);

  if (!isSalesOpen()) {
    throw new AppError(
      `Ticket sales are closed. Open ${config.game.salesOpenHour}:00–${config.game.salesCloseHour}:00.`,
      400
    );
  }

  // 2. Check draw exists and is open (created by the cron job at day start,
  //    but we self-heal here in case it's the very first request of the day)
  let draw = db.prepare("SELECT * FROM draws WHERE date = ?").get(drawDate);
  if (!draw) {
    db.prepare("INSERT INTO draws (date, status) VALUES (?, 'open')").run(drawDate);
    draw = db.prepare("SELECT * FROM draws WHERE date = ?").get(drawDate);
  }
  if (draw.status !== "open") {
    throw new AppError("This draw is no longer accepting ticket purchases", 400);
  }

  // 3. Enforce per-user daily ticket limit
  const userTicketsToday = db
    .prepare("SELECT COUNT(*) as count FROM tickets WHERE user_id = ? AND date = ?")
    .get(userId, drawDate).count;
  if (userTicketsToday >= config.game.maxTicketsPerUserPerDay) {
    throw new AppError(
      `You already have ${userTicketsToday} ticket(s) today. Limit is ${config.game.maxTicketsPerUserPerDay}.`,
      400
    );
  }

  // 4. Enforce coin balance
  if (user.coins < config.game.ticketPrice) {
    throw new AppError(
      `Not enough coins. Need ${config.game.ticketPrice}, you have ${user.coins}.`,
      400
    );
  }

  // 5. Enforce global daily ticket cap & find next available slot number
  const soldCount = db
    .prepare("SELECT COUNT(*) as count FROM tickets WHERE date = ?")
    .get(drawDate).count;
  if (soldCount >= config.game.totalTicketsPerDay) {
    throw new AppError("Sold out — all tickets for today are gone.", 400);
  }

  // Find the lowest unsold slot_number (0-indexed, 0-49) for this draw date
  const soldNumbers = new Set(
    db
      .prepare("SELECT slot_number FROM tickets WHERE date = ?")
      .all(drawDate)
      .map((r) => r.slot_number)
  );
  let slotNumber = null;
  for (let n = 0; n < config.game.totalTicketsPerDay; n++) {
    if (!soldNumbers.has(n)) {
      slotNumber = n;
      break;
    }
  }
  if (slotNumber === null) {
    throw new AppError("Sold out — all tickets for today are gone.", 400);
  }

  // 6. Deduct coins
  const newBalance = user.coins - config.game.ticketPrice;
  db.prepare("UPDATE users SET coins = ? WHERE id = ?").run(newBalance, userId);

  // 7. Insert the ticket. The UNIQUE(date, slot_number) constraint
  //    means if somehow two transactions raced to this exact slot, the
  //    DB itself throws here and the whole transaction rolls back —
  //    including the coin deduction above. Nobody loses coins for nothing.
  const insertTicket = db.prepare(`
    INSERT INTO tickets (user_id, date, slot_number, price_paid)
    VALUES (?, ?, ?, ?)
  `);
  const result = insertTicket.run(userId, drawDate, slotNumber, config.game.ticketPrice);

  // 8. Log the transaction for auditability
  db.prepare(`
    INSERT INTO coin_transactions (user_id, amount, reason, reference_id, balance_after)
    VALUES (?, ?, 'ticket_purchase', ?, ?)
  `).run(userId, -config.game.ticketPrice, result.lastInsertRowid, newBalance);

  // 9. Update the draw's running total
  db.prepare("UPDATE draws SET total_tickets = total_tickets + 1 WHERE date = ?").run(drawDate);

  return {
    ticketId: result.lastInsertRowid,
    slotNumber,
    drawDate,
    coinsRemaining: newBalance,
  };
});

function buyTicket(userId, drawDate) {
  const date = drawDate || todayDateString();
  const ticket = buyTicketTransaction(userId, date);

  // Outside the critical transaction: mark referral active (non-blocking,
  // doesn't need to be atomic with the purchase itself)
  try {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    markReferralActiveIfNeeded(user);
  } catch (e) {
    console.error("Referral activation failed (non-fatal):", e);
  }

  return ticket;
}

function getMyTicketsForDate(userId, drawDate) {
  const date = drawDate || todayDateString();
  return db
    .prepare("SELECT * FROM tickets WHERE user_id = ? AND date = ? ORDER BY slot_number")
    .all(userId, date);
}

module.exports = {
  todayDateString,
  isSalesOpen,
  getAvailableTicketCount,
  buyTicket,
  getMyTicketsForDate,
};