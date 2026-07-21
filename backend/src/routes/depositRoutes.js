// src/routes/depositRoutes.js

const express = require("express");
const router = express.Router();

const { getInfo, deposit, getHistory } = require("../controllers/depositController");
const { requireAuth } = require("../middleware/auth");
const { validate, depositSchema } = require("../middleware/validate");
const { depositLimiter } = require("../middleware/rateLimiter");

// GET /api/deposit/info
router.get("/info", requireAuth, getInfo);

// POST /api/deposit
router.post("/", requireAuth, depositLimiter, validate(depositSchema), deposit);

// GET /api/deposit/history
router.get("/history", requireAuth, getHistory);

module.exports = router;