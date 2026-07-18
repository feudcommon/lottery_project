// src/routes/leaderboardRoutes.js
// Public read — no auth required to view rankings, but we still try to
// attach req.user if a valid token is present so "myRank" can be included.
const express = require("express");
const router = express.Router();
const { getLeaderboard } = require("../controllers/leaderboardController");
const { verifyToken } = require("../utils/jwt");
const db = require("../db/connection");
const { globalLimiter } = require("../middleware/rateLimiter");

// Optional auth: attaches req.user if a valid Bearer token is present,
// but never blocks the request if it's missing/invalid.
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme === "Bearer" && token) {
    try {
      const payload = verifyToken(token);
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.sub);
      if (user) req.user = user;
    } catch {
      // ignore invalid token, proceed unauthenticated
    }
  }
  next();
}

router.get("/", globalLimiter, optionalAuth, getLeaderboard);

module.exports = router;