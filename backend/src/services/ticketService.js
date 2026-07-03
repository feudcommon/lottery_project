// src/services/ticketService.js
//
// THE MOST IMPORTANT FILE FOR PREVENTING COIN ABUSE.

const db = require("../db/connection");          // ✅ IMPORT DB FIRST
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
  const result = db
    .prepare("SELECT COUNT(*) as count FROM tickets WHERE draw_date = ?")
    .get(drawDate);
  const sold = result ? result.count : 0;
  return Math.max(0, config.game.totalTicketsPerDay - sold);
}

/**
 * The core, safety-critical operation: buy one ticket with desired slot number.
 * Wrapped in db.transaction so it's all-or-nothing and race-condition-free.
 */
const buyTicketTransaction = db.transaction((userId, drawDate, desiredSlotNumber) => {
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

  // 2. Check draw exists and is open
  let draw = db.prepare("SELECT * FROM draws WHERE draw_date = ?").get(drawDate);
  if (!draw) {
    db.prepare("INSERT INTO draws (draw_date, status) VALUES (?, 'open')").run(drawDate);
    draw = db.prepare("SELECT * FROM draws WHERE draw_date = ?").get(drawDate);
  }
  if (draw.status !== "open") {
    throw new AppError("This draw is no longer accepting ticket purchases", 400);
  }

  // 3. Enforce per-user daily ticket limit
  const userTicketsResult = db
    .prepare("SELECT COUNT(*) as count FROM tickets WHERE user_id = ? AND draw_date = ?")
    .get(userId, drawDate);
  const userTicketsToday = userTicketsResult ? userTicketsResult.count : 0;
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

  // 5. Enforce global daily ticket cap
  const soldResult = db
    .prepare("SELECT COUNT(*) as count FROM tickets WHERE draw_date = ?")
    .get(drawDate);
  const soldCount = soldResult ? soldResult.count : 0;
  if (soldCount >= config.game.totalTicketsPerDay) {
    throw new AppError("Sold out — all tickets for today are gone.", 400);
  }

  // 6. ✅ NEW: Use the desired slot number instead of auto-finding
  const soldNumbers = new Set(
    db
      .prepare("SELECT ticket_number FROM tickets WHERE draw_date = ?")
      .all(drawDate)
      .map((r) => r.ticket_number)
  );

  const ticketNumber = desiredSlotNumber;  // ✅ Use user's choice

  // Validate the slot
  if (ticketNumber < 0 || ticketNumber >= config.game.totalTicketsPerDay) {
    throw new AppError("Invalid ticket slot number", 400);
  }
  if (soldNumbers.has(ticketNumber)) {
    throw new AppError("This ticket slot is already sold", 400);
  }

  // 7. Deduct coins
  const newBalance = user.coins - config.game.ticketPrice;
  db.prepare("UPDATE users SET coins = ? WHERE id = ?").run(newBalance, userId);

  // 8. Insert the ticket
  const insertTicket = db.prepare(`
    INSERT INTO tickets (user_id, draw_date, ticket_number, price_paid)
    VALUES (?, ?, ?, ?)
  `);
  const result = insertTicket.run(userId, drawDate, ticketNumber, config.game.ticketPrice);

  // 9. Log the transaction for auditability
  db.prepare(`
    INSERT INTO coin_transactions (user_id, amount, reason, reference_id, balance_after)
    VALUES (?, ?, 'ticket_purchase', ?, ?)
  `).run(userId, -config.game.ticketPrice, result.lastInsertRowid, newBalance);

  // 10. Update the draw's running total
  db.prepare("UPDATE draws SET total_tickets_sold = total_tickets_sold + 1 WHERE draw_date = ?").run(drawDate);

  return {
    ticketId: result.lastInsertRowid,
    ticketNumber,
    drawDate,
    coinsRemaining: newBalance,
  };
});

// ✅ UPDATE: Pass slotNumber to transaction
function buyTicket(userId, drawDate, slotNumber) {
  const date = drawDate || todayDateString();
  const ticket = buyTicketTransaction(userId, date, slotNumber);

  // Outside the critical transaction: mark referral active (non-blocking)
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
    .prepare("SELECT * FROM tickets WHERE user_id = ? AND draw_date = ? ORDER BY ticket_number")
    .all(userId, date);
}

module.exports = {
  todayDateString,
  isSalesOpen,
  getAvailableTicketCount,
  buyTicket,
  getMyTicketsForDate,
};