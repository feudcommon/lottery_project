// src/routes/withdrawalRoutes.js

const express = require("express");
const router = express.Router();

const { withdraw, getEligibility, getHistory } = require("../controllers/withdrawalController");
const { requireAuth } = require("../middleware/auth");
const { validate, withdrawSchema } = require("../middleware/validate");
const { withdrawLimiter } = require("../middleware/rateLimiter");

// POST /api/withdraw
router.post("/", requireAuth, withdrawLimiter, validate(withdrawSchema), withdraw);

// GET /api/withdraw/eligibility
router.get("/eligibility", requireAuth, getEligibility);

// GET /api/withdraw/history
router.get("/history", requireAuth, getHistory);

module.exports = router;
