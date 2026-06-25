// src/routes/coinRoutes.js

const express = require("express");
const router = express.Router();

const { spin } = require("../controllers/coinController");
const { requireAuth } = require("../middleware/auth");
const { validate, spinSchema } = require("../middleware/validate");
const { spinLimiter } = require("../middleware/rateLimiter");

// POST /api/spin
router.post("/spin", requireAuth, spinLimiter, validate(spinSchema), spin);

module.exports = router;
