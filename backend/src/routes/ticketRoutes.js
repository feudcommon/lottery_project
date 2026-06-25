// src/routes/ticketRoutes.js

const express = require("express");
const router = express.Router();

const { buyTicket, getMyTicketsToday } = require("../controllers/ticketController");
const { requireAuth } = require("../middleware/auth");
const { validate, buyTicketSchema } = require("../middleware/validate");
const { buyTicketLimiter } = require("../middleware/rateLimiter");

// POST /api/buy-ticket
router.post("/buy-ticket", requireAuth, buyTicketLimiter, validate(buyTicketSchema), buyTicket);

// GET /api/tickets/today
router.get("/tickets/today", requireAuth, getMyTicketsToday);

module.exports = router;
