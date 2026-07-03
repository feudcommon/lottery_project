// Change the transaction to accept desiredSlotNumber
const buyTicketTransaction = db.transaction((userId, drawDate, desiredSlotNumber) => {
  // 1-7: [same existing checks as before]
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) throw new AppError("User not found", 404);
  if (user.is_banned) throw new AppError("Account suspended", 403);

  if (!isSalesOpen()) {
    throw new AppError(
      `Ticket sales are closed. Open ${config.game.salesOpenHour}:00–${config.game.salesCloseHour}:00.`,
      400
    );
  }

  let draw = db.prepare("SELECT * FROM draws WHERE draw_date = ?").get(drawDate);
  if (!draw) {
    db.prepare("INSERT INTO draws (draw_date, status) VALUES (?, 'open')").run(drawDate);
    draw = db.prepare("SELECT * FROM draws WHERE draw_date = ?").get(drawDate);
  }
  if (draw.status !== "open") {
    throw new AppError("This draw is no longer accepting ticket purchases", 400);
  }

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

  if (user.coins < config.game.ticketPrice) {
    throw new AppError(
      `Not enough coins. Need ${config.game.ticketPrice}, you have ${user.coins}.`,
      400
    );
  }

  const soldResult = db
    .prepare("SELECT COUNT(*) as count FROM tickets WHERE draw_date = ?")
    .get(drawDate);
  const soldCount = soldResult ? soldResult.count : 0;
  if (soldCount >= config.game.totalTicketsPerDay) {
    throw new AppError("Sold out — all tickets for today are gone.", 400);
  }

  // ✅ NEW: Use the desired slot number instead of auto-finding
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

  // Deduct coins
  const newBalance = user.coins - config.game.ticketPrice;
  db.prepare("UPDATE users SET coins = ? WHERE id = ?").run(newBalance, userId);

  // Insert ticket
  const insertTicket = db.prepare(`
    INSERT INTO tickets (user_id, draw_date, ticket_number, price_paid)
    VALUES (?, ?, ?, ?)
  `);
  const result = insertTicket.run(userId, drawDate, ticketNumber, config.game.ticketPrice);

  // Log transaction
  db.prepare(`
    INSERT INTO coin_transactions (user_id, amount, reason, reference_id, balance_after)
    VALUES (?, ?, 'ticket_purchase', ?, ?)
  `).run(userId, -config.game.ticketPrice, result.lastInsertRowid, newBalance);

  // Update draw total
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

  try {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    markReferralActiveIfNeeded(user);
  } catch (e) {
    console.error("Referral activation failed (non-fatal):", e);
  }

  return ticket;
}