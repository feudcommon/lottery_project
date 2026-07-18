// src/routes/jackpotRoutes.js
const express = require("express");
const router = express.Router();
const { getStatus, getHistory, verify } = require("../controllers/jackpotController");
const { globalLimiter } = require("../middleware/rateLimiter");

router.get("/status", globalLimiter, getStatus);
router.get("/history", globalLimiter, getHistory);
router.get("/:weekStart/verify", globalLimiter, verify);

module.exports = router;