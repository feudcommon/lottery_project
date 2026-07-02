// src/controllers/ticketController.js
const ticketService = require("../services/ticketService");
const db = require("../db/connection");
const { asyncHandler } = require("../middleware/errorHandler");

// POST /api/buy-ticket
const buyTicket = asyncHandler(async (req, res) => {
  const { drawDate } = req.body;
  const result = ticketService.buyTicket(req.user.id, drawDate);
  res.status(201).json({ message: "Ticket purchased!", ticket: result });
});

// GET /api/tickets/today
const getMyTicketsToday = asyncHandler(async (req, res) => {
  const drawDate = ticketService.todayDateString();
  
  // Get user's tickets
  const myTickets = ticketService.getMyTicketsForDate(req.user.id, drawDate);
  
  // Get ALL tickets sold today (for display)
  const allTickets = db.prepare(
    "SELECT * FROM tickets WHERE draw_date = ? ORDER BY ticket_number"
  ).all(drawDate);
  
  const available = ticketService.getAvailableTicketCount(drawDate);
  
  res.json({
    drawDate,
    salesOpen: ticketService.isSalesOpen(),
    tickets: allTickets,          // ✅ ALL sold tickets (show as gray)
    myTickets: myTickets,         // ✅ User's tickets (show as green)
    ticketsAvailable: available,
  });
});

module.exports = { buyTicket, getMyTicketsToday };