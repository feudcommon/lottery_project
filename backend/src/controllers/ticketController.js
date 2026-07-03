// src/controllers/ticketController.js
const ticketService = require("../services/ticketService");
const db = require("../db/connection");
const { asyncHandler } = require("../middleware/errorHandler");

// POST /api/buy-ticket
const buyTicket = asyncHandler(async (req, res) => {
  let { drawDate, slotNumber } = req.body;
  const userId = req.user.id;
  
  console.log("Buying ticket - userId:", userId, "slotNumber:", slotNumber);
  
  // If slotNumber is undefined, auto-find the next available
  if (slotNumber === undefined || slotNumber === null) {
    console.log("slotNumber undefined, auto-finding next available slot");
    const drawDate_str = drawDate || ticketService.todayDateString();
    
    const soldNumbers = new Set(
      db.prepare("SELECT ticket_number FROM tickets WHERE draw_date = ?")
        .all(drawDate_str)
        .map((r) => r.ticket_number)
    );
    
    slotNumber = null;
    for (let n = 0; n < 50; n++) {
      if (!soldNumbers.has(n)) {
        slotNumber = n;
        break;
      }
    }
    
    if (slotNumber === null) {
      return res.status(400).json({ error: "All tickets sold out" });
    }
    
    console.log("Auto-assigned slot:", slotNumber);
  }
  
  const result = ticketService.buyTicket(userId, drawDate, slotNumber);
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
    tickets: allTickets,          // ✅ ALL sold tickets
    myTickets: myTickets,         // ✅ User's tickets
    ticketsAvailable: available,
  });
});

module.exports = { buyTicket, getMyTicketsToday };