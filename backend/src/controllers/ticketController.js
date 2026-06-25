// src/controllers/ticketController.js

const ticketService = require("../services/ticketService");
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
  const tickets = ticketService.getMyTicketsForDate(req.user.id, drawDate);
  const available = ticketService.getAvailableTicketCount(drawDate);

  res.json({
    drawDate,
    salesOpen: ticketService.isSalesOpen(),
    myTickets: tickets,
    ticketsAvailable: available,
  });
});

module.exports = { buyTicket, getMyTicketsToday };
